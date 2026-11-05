import { REPORT_SIZE, type Transport } from '../protocol/packet';

export class TransportError extends Error {
  override readonly name = 'TransportError';
}

/** Sous-ensemble de HIDDevice utilisé (un HIDDevice convient ; permet un faux périphérique dans les tests). */
export interface HidDeviceLike {
  readonly opened: boolean;
  readonly productName: string;
  open(): Promise<void>;
  close(): Promise<void>;
  sendReport(reportId: number, data: BufferSource): Promise<void>;
  addEventListener(type: 'inputreport', listener: (event: Event) => void): void;
  removeEventListener(type: 'inputreport', listener: (event: Event) => void): void;
}

/**
 * Transport WebHID : une seule requête à la fois (le firmware répond en écho, deux requêtes simultanées
 * mélangeraient les réponses), délai d'attente puis une nouvelle tentative.
 */
export class HidTransport implements Transport {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    readonly device: HidDeviceLike,
    private readonly timeoutMs = 1000,
    private readonly attempts = 2,
  ) {}

  static async open(device: HidDeviceLike, timeoutMs?: number): Promise<HidTransport> {
    if (!device.opened) await device.open();
    return new HidTransport(device, timeoutMs);
  }

  request(report: Uint8Array): Promise<Uint8Array> {
    if (report.length !== REPORT_SIZE) {
      return Promise.reject(new TransportError(`Rapport de ${String(report.length)} octets (32 attendus)`));
    }
    const run = async (): Promise<Uint8Array> => {
      let lastError: unknown;
      for (let attempt = 0; attempt < this.attempts; attempt++) {
        try {
          return await this.exchange(report);
        } catch (error) {
          lastError = error;
          if (!(error instanceof TransportError)) throw error;
        }
      }
      throw lastError;
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private exchange(report: Uint8Array): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const onReport = (event: Event): void => {
        const { data } = event as HIDInputReportEvent;
        cleanup();
        resolve(new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new TransportError('Le clavier ne répond pas'));
      }, this.timeoutMs);
      const cleanup = (): void => {
        clearTimeout(timer);
        this.device.removeEventListener('inputreport', onReport);
      };
      this.device.addEventListener('inputreport', onReport);
      this.device.sendReport(0, report).catch((error: unknown) => {
        cleanup();
        reject(error instanceof Error ? error : new TransportError(String(error)));
      });
    });
  }

  async close(): Promise<void> {
    await this.queue;
    if (this.device.opened) await this.device.close();
  }
}
