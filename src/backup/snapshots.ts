// Instantanés (.vil) gardés dans le navigateur, par clavier : à chaque connexion, avant chaque import, ou à la main.

export interface Snapshot {
  readonly id: string;
  readonly createdAt: string;
  readonly label: string;
  readonly vil: string;
  /** UID du clavier (hexadécimal) ; absent sur les instantanés d'avant le classement par clavier. */
  readonly uid?: string;
}

export interface SnapshotOptions {
  readonly uid?: string;
  readonly now?: Date;
  /** Ne rien ajouter si le dernier instantané de ce clavier contient déjà exactement cet état. */
  readonly skipIfSame?: boolean;
}

const STORAGE_KEY = 'colagan.snapshots';
/** Instantanés gardés par clavier. */
export const MAX_SNAPSHOTS = 5;
/** Plafond tous claviers confondus : le stockage du navigateur est limité (quelques Mo). */
export const MAX_TOTAL_SNAPSHOTS = 20;
/** Événement émis sur `document` quand la liste change (la feuille du clavier se met à jour). */
export const SNAPSHOTS_CHANGED = 'colagan:snapshots';

function readAll(): Snapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? (data as Snapshot[]) : [];
  } catch {
    return [];
  }
}

/** Instantanés, du plus récent au plus ancien ; avec `uid`, ceux de ce clavier (et les anciens sans UID). */
export function listSnapshots(uid?: string): Snapshot[] {
  const all = readAll();
  return uid === undefined ? all : all.filter((s) => s.uid === undefined || s.uid === uid);
}

/**
 * Ajoute un instantané en tête, en gardant les MAX_SNAPSHOTS derniers de chaque clavier ; renvoie false si le
 * stockage est indisponible (navigation privée, quota). Un état identique au dernier, avec `skipIfSame`, ne
 * crée rien et renvoie true.
 */
export function addSnapshot(label: string, vil: string, options: SnapshotOptions = {}): boolean {
  const now = options.now ?? new Date();
  const all = readAll();
  if (options.skipIfSame) {
    const last = all.find((s) => s.uid === options.uid);
    if (last?.vil === vil) return true;
  }
  const snapshot: Snapshot = {
    id: now.getTime().toString(36),
    createdAt: now.toISOString(),
    label,
    vil,
    ...(options.uid === undefined ? {} : { uid: options.uid }),
  };
  const kept: Snapshot[] = [];
  const perKeyboard = new Map<string | undefined, number>();
  for (const s of [snapshot, ...all]) {
    const count = perKeyboard.get(s.uid) ?? 0;
    if (count >= MAX_SNAPSHOTS || kept.length >= MAX_TOTAL_SNAPSHOTS) continue;
    perKeyboard.set(s.uid, count + 1);
    kept.push(s);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
  } catch {
    return false;
  }
  document.dispatchEvent(new Event(SNAPSHOTS_CHANGED));
  return true;
}

export function vilFileName(name: string, date = new Date()): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'clavier';
  const stamp = date.toISOString().slice(0, 16).replace('T', '_').replace(':', 'h');
  return `${slug}_${stamp}.vil`;
}

export function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
