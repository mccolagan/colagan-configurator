// Choix d'un keycode dans une fenêtre (tap-dance, combos, macros) : même panneau que pour les touches.
import { t } from '../i18n';
import type { KeycodeCatalog } from '../keycodes/catalog';
import type { LabelLayout } from '../keycodes/labels';
import { KeycodePicker } from './keycode-picker';

export function pickKeycode(
  catalog: KeycodeCatalog,
  layout: LabelLayout,
  title: string,
): Promise<number | undefined> {
  const dialog = document.createElement('dialog');
  dialog.className = 'confirm keycode-dialog';
  const heading = document.createElement('h2');
  heading.textContent = title;
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'secondary';
  cancel.textContent = t('edit.cancel');
  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.append(cancel);

  return new Promise((resolve) => {
    const close = (value: number | undefined): void => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    const picker = new KeycodePicker({ catalog, layout, onPick: close });
    picker.setEnabled(true);
    dialog.append(heading, picker.element, actions);
    document.body.append(dialog);
    cancel.addEventListener('click', () => {
      close(undefined);
    });
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      close(undefined);
    });
    dialog.showModal();
    picker.element.querySelector<HTMLInputElement>('.picker__search')?.focus();
  });
}
