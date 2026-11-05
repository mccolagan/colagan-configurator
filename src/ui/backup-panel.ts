// Onglet « Sauvegarde » : export / import .vil (format Vial) et instantanés automatiques.
import { addSnapshot, downloadText, listSnapshots, vilFileName } from '../backup/snapshots';
import {
  applyDiff,
  ApplyError,
  diffSize,
  diffStates,
  readKeyboardState,
  type StateDiff,
} from '../backup/state';
import { checkVil, stateToVil, vilToState, type Positions } from '../backup/vil-convert';
import { t } from '../i18n';
import { parseVil, stringifyVil } from '../io/vil';
import type { KeycodeCatalog } from '../keycodes/catalog';
import type { KeyboardClient } from '../protocol/client';
import { confirmDialog } from './confirm';

export interface BackupPanelOptions {
  readonly client: KeyboardClient;
  readonly catalog: KeycodeCatalog;
  readonly positions: Positions;
  readonly keyboardName: string;
  readonly ensureUnlocked: () => Promise<boolean>;
  /** Appelé après un import (même partiel) : la keymap affichée et l'historique doivent être rafraîchis. */
  readonly onImported: () => void;
}

type Level = 'ok' | 'warn' | 'error' | 'info';

export function renderBackupPanel(options: BackupPanelOptions): HTMLElement {
  const { client, catalog, positions } = options;
  const panel = document.createElement('section');
  panel.className = 'backup';
  panel.setAttribute('aria-label', t('view.backup'));

  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.id = 'vil-export';
  exportButton.textContent = t('backup.export');

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.vil,application/json';
  fileInput.id = 'vil-import';
  fileInput.hidden = true;
  const importButton = document.createElement('button');
  importButton.type = 'button';
  importButton.className = 'secondary';
  importButton.textContent = t('backup.import');
  importButton.addEventListener('click', () => {
    fileInput.click();
  });

  const snapshotButton = document.createElement('button');
  snapshotButton.type = 'button';
  snapshotButton.className = 'secondary';
  snapshotButton.id = 'snapshot-create';
  snapshotButton.textContent = t('backup.snapshotNow');

  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.append(exportButton, importButton, snapshotButton, fileInput);

  const help = document.createElement('p');
  help.className = 'backup__help';
  help.textContent = t('backup.help');

  const status = document.createElement('p');
  status.className = 'status backup__status';
  status.id = 'backup-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const snapshotsTitle = document.createElement('h3');
  snapshotsTitle.textContent = t('backup.snapshots');
  const snapshotList = document.createElement('ul');
  snapshotList.className = 'snapshots';
  snapshotList.id = 'snapshots';

  panel.append(help, actions, status, snapshotsTitle, snapshotList);

  const say = (level: Level, message: string): void => {
    status.dataset.level = level;
    status.textContent = message;
  };
  const busy = (on: boolean): void => {
    for (const b of [exportButton, importButton, snapshotButton]) b.disabled = on;
  };

  const currentVil = async (): Promise<string> =>
    stringifyVil(stateToVil(client.info, await readKeyboardState(client), catalog, positions));

  const snapshot = async (label: string): Promise<boolean> => {
    const ok = addSnapshot(label, await currentVil());
    renderSnapshots();
    return ok;
  };

  function renderSnapshots(): void {
    const snapshots = listSnapshots();
    snapshotList.replaceChildren(
      ...snapshots.map((s) => {
        const item = document.createElement('li');
        const label = document.createElement('span');
        label.textContent = `${new Date(s.createdAt).toLocaleString('fr-FR')} · ${s.label}`;
        const download = document.createElement('button');
        download.type = 'button';
        download.className = 'secondary';
        download.textContent = t('backup.download');
        download.addEventListener('click', () => {
          downloadText(vilFileName(options.keyboardName, new Date(s.createdAt)), s.vil);
        });
        const restore = document.createElement('button');
        restore.type = 'button';
        restore.className = 'secondary';
        restore.textContent = t('backup.restore');
        restore.addEventListener('click', () => void importText(s.vil, s.label));
        item.append(label, download, restore);
        return item;
      }),
    );
    if (!snapshots.length) {
      const empty = document.createElement('li');
      empty.className = 'snapshots__empty';
      empty.textContent = t('backup.noSnapshot');
      snapshotList.append(empty);
    }
  }

  const summary = (diff: StateDiff, warnings: readonly string[]): HTMLElement => {
    const body = document.createElement('div');
    for (const warning of warnings) {
      const p = document.createElement('p');
      p.className = 'status';
      p.dataset.level = 'warn';
      p.textContent = warning === 'uid' ? t('backup.warnUid') : t('backup.warnLayers');
      body.append(p);
    }
    const list = document.createElement('ul');
    const lines: [number, string][] = [
      [diff.keys.length, t('backup.sumKeys', { n: diff.keys.length })],
      [diff.macros ? 1 : 0, t('backup.sumMacros')],
      [diff.tapDance.length, t('backup.sumTapDance', { n: diff.tapDance.length })],
      [diff.combos.length, t('backup.sumCombos', { n: diff.combos.length })],
      [diff.keyOverrides.length, t('backup.sumKeyOverrides', { n: diff.keyOverrides.length })],
      [diff.altRepeatKeys.length, t('backup.sumAltRepeat', { n: diff.altRepeatKeys.length })],
      [diff.settings.length, t('backup.sumSettings', { n: diff.settings.length })],
    ];
    for (const [count, text] of lines) {
      if (!count) continue;
      const li = document.createElement('li');
      li.textContent = text;
      list.append(li);
    }
    const note = document.createElement('p');
    note.textContent = t('backup.snapshotNote');
    body.append(list, note);
    return body;
  };

  async function importText(text: string, source: string): Promise<void> {
    busy(true);
    try {
      say('info', t('backup.reading'));
      const vil = parseVil(text);
      const { warnings } = checkVil(vil, client.info);
      const current = await readKeyboardState(client);
      const target = vilToState(vil, client.info, current, catalog, positions);
      const diff = diffStates(current, target, client.info);
      if (!diffSize(diff)) {
        say('ok', t('backup.nothing'));
        return;
      }
      const confirmed = await confirmDialog(t('backup.confirmTitle', { source }), summary(diff, warnings), {
        confirmLabel: t('backup.confirmApply'),
        danger: warnings.length > 0,
      });
      if (!confirmed) {
        say('info', t('backup.cancelled'));
        return;
      }
      const saved = addSnapshot(
        t('backup.autoLabel', { source }),
        stringifyVil(stateToVil(client.info, current, catalog, positions)),
      );
      renderSnapshots();
      if (!saved) say('warn', t('backup.snapshotFailed'));
      const report = await applyDiff(client, diff, target, {
        ensureUnlocked: options.ensureUnlocked,
        onProgress: (done, total) => {
          say('info', t('backup.progress', { done, total }));
        },
      });
      options.onImported();
      say(
        report.skipped.length ? 'warn' : 'ok',
        report.skipped.length
          ? t('backup.doneSkipped', { done: report.done, total: report.total })
          : t('backup.done', { done: report.done }),
      );
    } catch (error) {
      if (error instanceof ApplyError) {
        options.onImported();
        say('error', t('backup.partial', { done: error.done, total: error.total, message: error.message }));
      } else {
        say('error', t('backup.error', { message: error instanceof Error ? error.message : String(error) }));
      }
    } finally {
      busy(false);
    }
  }

  exportButton.addEventListener('click', () => {
    void (async () => {
      busy(true);
      try {
        say('info', t('backup.reading'));
        const text = await currentVil();
        downloadText(vilFileName(options.keyboardName), text);
        say('ok', t('backup.exported'));
      } catch (error) {
        say('error', t('backup.error', { message: error instanceof Error ? error.message : String(error) }));
      } finally {
        busy(false);
      }
    })();
  });

  snapshotButton.addEventListener('click', () => {
    void (async () => {
      busy(true);
      try {
        say('info', t('backup.reading'));
        say((await snapshot(t('backup.manualLabel'))) ? 'ok' : 'warn', t('backup.snapshotDone'));
      } catch (error) {
        say('error', t('backup.error', { message: error instanceof Error ? error.message : String(error) }));
      } finally {
        busy(false);
      }
    })();
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    void file.text().then((text) => importText(text, file.name));
  });

  renderSnapshots();
  return panel;
}
