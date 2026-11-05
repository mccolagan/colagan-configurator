// Instantanés automatiques (.vil) gardés dans le navigateur avant chaque action risquée.

export interface Snapshot {
  readonly id: string;
  readonly createdAt: string;
  readonly label: string;
  readonly vil: string;
}

const STORAGE_KEY = 'colagan.snapshots';
export const MAX_SNAPSHOTS = 5;

export function listSnapshots(): Snapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? (data as Snapshot[]) : [];
  } catch {
    return [];
  }
}

/** Ajoute un instantané en tête ; renvoie false si le stockage est indisponible (navigation privée, quota). */
export function addSnapshot(label: string, vil: string, now = new Date()): boolean {
  const snapshot: Snapshot = { id: now.getTime().toString(36), createdAt: now.toISOString(), label, vil };
  try {
    const list = [snapshot, ...listSnapshots()].slice(0, MAX_SNAPSHOTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
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
