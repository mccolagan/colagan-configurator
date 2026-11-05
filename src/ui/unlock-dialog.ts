// Déverrouillage Vial : l'utilisateur tient les touches indiquées pendant ~5 s (décompte du firmware).
import { t } from '../i18n';
import type { Transport } from '../protocol/packet';
import { getUnlockStatus, unlockPoll, unlockStart } from '../protocol/vial';

const POLL_MS = 100;
const COUNTER_MAX = 50;

/**
 * Renvoie true une fois le clavier déverrouillé, false si l'utilisateur abandonne.
 * `describeKey` donne le nom affiché d'une position [ligne, colonne] (ex. « Enter [8,5] »).
 */
export async function unlockKeyboard(
  transport: Transport,
  describeKey: (row: number, col: number) => string,
): Promise<boolean> {
  const status = await getUnlockStatus(transport);
  if (status.unlocked) return true;

  const dialog = document.createElement('dialog');
  dialog.className = 'confirm unlock';
  const heading = document.createElement('h2');
  heading.textContent = t('unlock.title');
  const text = document.createElement('p');
  text.textContent = t('unlock.body', { keys: status.keys.map(([r, c]) => describeKey(r, c)).join(' + ') });
  const progress = document.createElement('progress');
  progress.max = COUNTER_MAX;
  progress.value = 0;
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'secondary';
  cancel.textContent = t('edit.cancel');
  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.append(cancel);
  dialog.append(heading, text, progress, actions);
  document.body.append(dialog);

  const state = { cancelled: false };
  const stop = (): void => {
    state.cancelled = true;
  };
  cancel.addEventListener('click', stop);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    stop();
  });
  dialog.showModal();

  try {
    await unlockStart(transport);
    while (!state.cancelled) {
      const poll = await unlockPoll(transport);
      if (poll.unlocked) return true;
      progress.value = COUNTER_MAX - poll.counter;
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
    return false;
  } finally {
    dialog.close();
    dialog.remove();
  }
}
