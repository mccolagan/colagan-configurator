import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseVil, stringifyVil, type VilFile } from '../io/vil';
import { parseKle } from '../keyboard/kle';
import { KeyboardClient } from '../protocol/client';
import { deserializeMacros, serializeMacros, type Macro } from '../protocol/macro';
import { colaganCatalog as catalog, fakeColagan } from '../protocol/test-helpers';
import { applyDiff, diffSize, diffStates, readKeyboardState } from './state';
import { checkVil, stateToVil, vilToState, VilImportError } from './vil-convert';

const fixtureText = readFileSync('tests/fixtures/colagan-v2-default.vil', 'utf8');

async function connect() {
  const keyboard = fakeColagan();
  const client = await KeyboardClient.connect(keyboard);
  const positions = new Set(
    parseKle(client.info.definition.layouts.keymap).map((k) => `${String(k.row)},${String(k.col)}`),
  );
  return { keyboard, client, positions };
}

const noUnlock = { ensureUnlocked: () => Promise.resolve(false) };

function setVilKey(vil: VilFile, layer: number, row: number, col: number, name: string): void {
  const cells = vil.layout[layer]?.[row];
  if (!cells) throw new Error('position absente du fichier');
  cells[col] = name;
}

describe('export .vil', () => {
  it('reproduit octet pour octet le fichier exporté par Vial', async () => {
    const { client, positions } = await connect();
    const state = await readKeyboardState(client);
    expect(stringifyVil(stateToVil(client.info, state, catalog, positions))).toBe(fixtureText);
  });
});

describe('macros', () => {
  const macros: Macro[] = [
    [
      ['text', 'Hello'],
      ['tap', 'KC_ENTER'],
    ],
    [
      ['down', 'KC_LSHIFT'],
      ['tap', 'KC_A', 'KC_B'],
      ['up', 'KC_LSHIFT'],
      ['delay', 600],
    ],
    [['tap', 'LCTL(KC_C)', 'KC_HOME']],
  ];

  it('font l’aller-retour sérialisation / désérialisation, keycodes 16 bits compris', () => {
    const buffer = serializeMacros(macros, 16, catalog);
    const back = deserializeMacros(buffer, 16, catalog);
    expect(back.slice(0, 3)).toEqual(macros);
    expect(back.slice(3).every((m) => m.length === 0)).toBe(true);
  });

  it('code les délais et les keycodes à octet bas nul comme QMK', () => {
    const delay = serializeMacros([[['delay', 600]]], 1, catalog);
    expect([...delay]).toEqual([1, 4, (600 % 255) + 1, Math.floor(600 / 255) + 1, 0]);
    const ctrl = serializeMacros([[['tap', 'LCTL(KC_NO)']]], 1, catalog);
    expect([...ctrl]).toEqual([1, 5, 0x01, 0xff, 0]);
    expect(deserializeMacros(ctrl, 1, catalog)[0]).toEqual([['tap', 'LCTL(KC_NO)']]);
  });
});

describe('import .vil', () => {
  it('refuse une matrice différente et signale un autre clavier', async () => {
    const { client } = await connect();
    const vil = parseVil(fixtureText);
    expect(checkVil(vil, client.info).warnings).toEqual([]);
    expect(checkVil({ ...vil, uid: 1n }, client.info).warnings).toContain('uid');
    expect(() => checkVil({ ...vil, layout: vil.layout.map((l) => l.slice(1)) }, client.info)).toThrow(
      VilImportError,
    );
  });

  it('n’écrit que les différences, macros comprises après déverrouillage', async () => {
    const { keyboard, client, positions } = await connect();
    const current = await readKeyboardState(client);
    const vil = parseVil(fixtureText);
    setVilKey(vil, 0, 0, 0, 'KC_Q');
    setVilKey(vil, 7, 1, 1, 'MO(2)');
    vil.macro[0] = [['text', 'gg']];
    vil.tap_dance[3] = ['KC_A', 'KC_B', 'KC_NO', 'KC_NO', 180];
    vil.settings['7'] = 180;
    const target = vilToState(vil, client.info, current, catalog, positions);
    const diff = diffStates(current, target, client.info);
    expect(diff.keys).toHaveLength(2);
    expect(diff.macros).toBe(true);
    expect(diff.tapDance).toEqual([3]);
    expect(diff.settings).toEqual([7]);
    expect(diffSize(diff)).toBe(5);

    const sentBefore = keyboard.sent.length;
    const report = await applyDiff(client, diff, target, {
      ensureUnlocked: () => {
        keyboard.unlocked = true;
        return Promise.resolve(true);
      },
    });
    expect(report).toEqual({ done: 5, total: 5, skipped: [] });
    expect(keyboard.sent.length - sentBefore).toBeLessThan(20);
    const after = await readKeyboardState(client);
    expect(diffSize(diffStates(after, target, client.info))).toBe(0);
    expect(keyboard.settings.get(7)).toBe(180);
  });

  it('saute les macros si le déverrouillage est refusé', async () => {
    const { client, positions } = await connect();
    const current = await readKeyboardState(client);
    const vil = parseVil(fixtureText);
    vil.macro[1] = [['tap', 'KC_A']];
    const target = vilToState(vil, client.info, current, catalog, positions);
    const report = await applyDiff(client, diffStates(current, target, client.info), target, noUnlock);
    expect(report.skipped).toEqual(['macros']);
  });

  it('refuse un keycode illisible avant toute écriture', async () => {
    const { client, positions } = await connect();
    const current = await readKeyboardState(client);
    const vil = parseVil(fixtureText);
    setVilKey(vil, 0, 0, 0, 'KC_PAS_UN_KEYCODE');
    expect(() => vilToState(vil, client.info, current, catalog, positions)).toThrow(VilImportError);
  });
});
