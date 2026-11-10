import { beforeEach, describe, expect, it } from 'vitest';
import {
  addSnapshot,
  listSnapshots,
  MAX_SNAPSHOTS,
  MAX_TOTAL_SNAPSHOTS,
  SNAPSHOTS_CHANGED,
} from './snapshots';

const at = (minute: number): Date => new Date(Date.UTC(2026, 10, 10, 12, minute));

describe('instantanés par clavier', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('range les instantanés par UID et garde les anciens sans UID visibles partout', () => {
    addSnapshot('ancien', 'v0', { now: at(0) });
    addSnapshot('A', 'va', { uid: 'aa', now: at(1) });
    addSnapshot('B', 'vb', { uid: 'bb', now: at(2) });
    expect(listSnapshots('aa').map((s) => s.label)).toEqual(['A', 'ancien']);
    expect(listSnapshots('bb').map((s) => s.label)).toEqual(['B', 'ancien']);
    expect(listSnapshots()).toHaveLength(3);
  });

  it('n’ajoute rien si le dernier instantané du clavier a déjà cet état', () => {
    expect(addSnapshot('connexion', 'v1', { uid: 'aa', now: at(1), skipIfSame: true })).toBe(true);
    expect(addSnapshot('connexion', 'v1', { uid: 'aa', now: at(2), skipIfSame: true })).toBe(true);
    expect(listSnapshots('aa')).toHaveLength(1);
    addSnapshot('connexion', 'v2', { uid: 'aa', now: at(3), skipIfSame: true });
    expect(listSnapshots('aa').map((s) => s.vil)).toEqual(['v2', 'v1']);
  });

  it(`garde les ${String(MAX_SNAPSHOTS)} derniers par clavier, ${String(MAX_TOTAL_SNAPSHOTS)} en tout`, () => {
    for (let n = 0; n < MAX_SNAPSHOTS + 3; n++)
      addSnapshot(`A${String(n)}`, `a${String(n)}`, { uid: 'aa', now: at(n) });
    addSnapshot('B', 'vb', { uid: 'bb', now: at(30) });
    const a = listSnapshots('aa');
    expect(a).toHaveLength(MAX_SNAPSHOTS);
    expect(a[0]?.label).toBe(`A${String(MAX_SNAPSHOTS + 2)}`);
    expect(listSnapshots('bb')).toHaveLength(1);
    for (let n = 0; n < 6; n++)
      for (let k = 0; k < MAX_SNAPSHOTS; k++)
        addSnapshot('x', `x${String(n)}-${String(k)}`, { uid: `u${String(n)}` });
    expect(listSnapshots().length).toBeLessThanOrEqual(MAX_TOTAL_SNAPSHOTS);
  });

  it('prévient la feuille du clavier quand la liste change', () => {
    let changes = 0;
    const count = (): void => {
      changes++;
    };
    document.addEventListener(SNAPSHOTS_CHANGED, count);
    addSnapshot('A', 'va', { uid: 'aa' });
    addSnapshot('A', 'va', { uid: 'aa', skipIfSame: true });
    document.removeEventListener(SNAPSHOTS_CHANGED, count);
    expect(changes).toBe(1);
  });
});
