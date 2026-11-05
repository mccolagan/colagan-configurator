// Confirmation dans la page (<dialog>), plutôt que window.confirm qui bloque tout l'onglet.
import { t } from '../i18n';

export interface ConfirmOptions {
  readonly confirmLabel?: string;
  /** Bouton de confirmation rouge (action destructrice). */
  readonly danger?: boolean;
}

export function confirmDialog(
  title: string,
  body: string | Node,
  options: ConfirmOptions = {},
): Promise<boolean> {
  const dialog = document.createElement('dialog');
  dialog.className = 'confirm';
  const heading = document.createElement('h2');
  heading.textContent = title;
  const content = document.createElement('div');
  content.className = 'confirm__body';
  if (typeof body === 'string') {
    const text = document.createElement('p');
    text.textContent = body;
    content.append(text);
  } else {
    content.append(body);
  }
  const actions = document.createElement('div');
  actions.className = 'actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'secondary';
  cancel.textContent = t('edit.cancel');
  const ok = document.createElement('button');
  ok.type = 'button';
  if (options.danger ?? true) ok.className = 'danger';
  ok.textContent = options.confirmLabel ?? t('edit.confirm');
  actions.append(cancel, ok);
  dialog.append(heading, content, actions);
  document.body.append(dialog);

  return new Promise((resolve) => {
    const close = (value: boolean): void => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    cancel.addEventListener('click', () => {
      close(false);
    });
    ok.addEventListener('click', () => {
      close(true);
    });
    // Échap : annulation
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      close(false);
    });
    dialog.showModal();
    cancel.focus();
  });
}
