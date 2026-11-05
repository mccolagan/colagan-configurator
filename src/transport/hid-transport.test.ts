import { afterEach, describe, expect, it, vi } from 'vitest';
import { HidTransport, TransportError, type HidDeviceLike } from './hid-transport';
import { packet } from '../protocol/packet';

/** Faux HIDDevice : répond en écho après `delay` ms, ou jamais si `silent`. */
class FakeHidDevice extends EventTarget implements HidDeviceLike {
  opened = false;
  readonly productName = 'Colagan V2';
  readonly sent: number[][] = [];
  silent = 0;

  constructor(private readonly delay = 5) {
    super();
  }

  open(): Promise<void> {
    this.opened = true;
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.opened = false;
    return Promise.resolve();
  }

  sendReport(_reportId: number, data: BufferSource): Promise<void> {
    const bytes = new Uint8Array(data as ArrayBuffer);
    this.sent.push(Array.from(bytes.subarray(0, 4)));
    if (this.silent > 0) {
      this.silent--;
      return Promise.resolve();
    }
    setTimeout(() => {
      const event = new Event('inputreport') as Event & { data: DataView };
      Object.defineProperty(event, 'data', { value: new DataView(bytes.slice().buffer) });
      this.dispatchEvent(event);
    }, this.delay);
    return Promise.resolve();
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe('HidTransport', () => {
  it('ouvre le périphérique et renvoie la réponse', async () => {
    const device = new FakeHidDevice();
    const transport = await HidTransport.open(device);
    expect(device.opened).toBe(true);
    const response = await transport.request(packet(0x11));
    expect(response[0]).toBe(0x11);
  });

  it('sérialise les requêtes concurrentes (une à la fois, dans l’ordre)', async () => {
    const device = new FakeHidDevice(10);
    const transport = await HidTransport.open(device);
    const responses = await Promise.all([1, 2, 3].map((n) => transport.request(packet(0x04, n))));
    expect(responses.map((r) => r[1])).toEqual([1, 2, 3]);
    expect(device.sent.map((s) => s[1])).toEqual([1, 2, 3]);
  });

  it('réessaie une fois après un délai dépassé', async () => {
    const device = new FakeHidDevice();
    device.silent = 1;
    const transport = await HidTransport.open(device, 30);
    expect((await transport.request(packet(0x01)))[0]).toBe(0x01);
    expect(device.sent).toHaveLength(2);
  });

  it('échoue après deux délais dépassés', async () => {
    const device = new FakeHidDevice();
    device.silent = 2;
    const transport = await HidTransport.open(device, 20);
    await expect(transport.request(packet(0x01))).rejects.toThrow(TransportError);
    // la file reste utilisable ensuite
    expect((await transport.request(packet(0x02)))[0]).toBe(0x02);
  });

  it('refuse un rapport qui ne fait pas 32 octets', async () => {
    const transport = await HidTransport.open(new FakeHidDevice());
    await expect(transport.request(new Uint8Array(8))).rejects.toThrow(TransportError);
  });
});
