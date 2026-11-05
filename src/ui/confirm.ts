// Confirmation dans la page (<dialog>), plutôt que window.confirm qui bloque tout l'onglet.
import { t } from '../i18n';

export function confirmDialog(title: string, body: string): Promise<boolean> {
  const dialog = document.createElement('dialog');
  dialog.className = 'confirm';
  const heading = document.createElement('h2');
  heading.textContent = title;
  const text = document.createElement('p');
  text.textContent = body;
  const actions = document.createElement('div');
  actions.className = 'actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'secondary';
  cancel.textContent = t('edit.cancel');
  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'danger';
  ok.textContent = t('edit.confirm');
  actions.append(cancel, ok);
  dialog.append(heading, text, actions);
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
