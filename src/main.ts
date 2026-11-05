import './styles.css';
import { detectHidSupport, type HidSupport } from './env/support';
import { applyTheme, readTheme, type ThemeChoice } from './env/theme';
import { t, type MessageKey } from './i18n';

// Interface raw HID de VIA / Vial
const RAW_HID_FILTER: HIDDeviceFilter = { usagePage: 0xff60, usage: 0x61 };

const SUPPORT_MESSAGES: Record<HidSupport, { key: MessageKey; level: 'ok' | 'error' }> = {
  ok: { key: 'support.ok', level: 'ok' },
  'insecure-context': { key: 'support.insecure', level: 'error' },
  'no-webhid': { key: 'support.noWebhid', level: 'error' },
};

function hex4(value: number): string {
  return value.toString(16).padStart(4, '0');
}

function render(root: HTMLElement): void {
  const support = detectHidSupport(window);
  const supportMessage = SUPPORT_MESSAGES[support];

  root.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div>
          <h1>${t('app.title')}</h1>
          <p>${t('app.subtitle')}</p>
        </div>
        <label>${t('theme.label')}
          <select id="theme">
            <option value="auto">${t('theme.auto')}</option>
            <option value="light">${t('theme.light')}</option>
            <option value="dark">${t('theme.dark')}</option>
          </select>
        </label>
      </header>
      <section class="panel">
        <p class="status" id="support" data-level="${supportMessage.level}">${t(supportMessage.key)}</p>
        <button id="connect" type="button" ${support === 'ok' ? '' : 'disabled'}>${t('connect.button')}</button>
        <p class="status" id="connection" role="status" aria-live="polite"></p>
      </section>
    </div>`;

  const themeSelect = root.querySelector<HTMLSelectElement>('#theme');
  if (themeSelect) {
    themeSelect.value = readTheme();
    themeSelect.addEventListener('change', () => {
      applyTheme(themeSelect.value as ThemeChoice);
    });
  }

  const connectButton = root.querySelector<HTMLButtonElement>('#connect');
  const connection = root.querySelector<HTMLParagraphElement>('#connection');
  if (connectButton && connection) {
    connectButton.addEventListener('click', () => {
      void connect(connection);
    });
  }
}

/** Test de connexion : sélection et ouverture du clavier (le protocole arrive à l'étape suivante). */
async function connect(output: HTMLElement): Promise<void> {
  try {
    const [device] = await navigator.hid.requestDevice({ filters: [RAW_HID_FILTER] });
    if (!device) {
      output.dataset.level = 'warn';
      output.textContent = t('connect.none');
      return;
    }
    if (!device.opened) {
      await device.open();
    }
    output.dataset.level = 'ok';
    output.textContent = t('connect.opened', {
      name: device.productName,
      vid: hex4(device.vendorId),
      pid: hex4(device.productId),
    });
  } catch (error) {
    output.dataset.level = 'error';
    const message = error instanceof Error ? error.message : String(error);
    output.textContent = `${t('connect.error', { message })} ${t('connect.linuxHint')}`;
  }
}

applyTheme(readTheme());
const root = document.querySelector<HTMLElement>('#app');
if (root) {
  render(root);
}
