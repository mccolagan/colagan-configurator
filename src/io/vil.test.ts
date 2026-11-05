import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseVil, stringifyPythonJson, stringifyVil, VilFormatError } from './vil';

const fixture = readFileSync('tests/fixtures/colagan-v2-default.vil', 'utf8');

describe('.vil', () => {
  it('relit et réécrit le fichier exporté par Vial octet pour octet', () => {
    expect(stringifyVil(parseVil(fixture))).toBe(fixture);
  });

  it('préserve l’uid 64 bits (au-delà de 2^53)', () => {
    const vil = parseVil(fixture);
    expect(vil.uid).toBe(14406476430202559502n);
    expect(vil.uid.toString(16)).toBe('c7ee15fc0742dc0e');
  });

  it('expose la structure attendue', () => {
    const vil = parseVil(fixture);
    expect(vil.layout).toHaveLength(8);
    expect(vil.layout[0]).toHaveLength(10);
    expect(vil.layout[0]?.[9]).toEqual(['KC_DELETE', 'KC_BSPACE', 'KC_ENTER', 'KC_RALT', 'USER00', -1]);
    expect(vil.tap_dance[0]).toEqual(['KC_NO', 'KC_NO', 'KC_NO', 'KC_NO', 200]);
  });

  it('refuse un JSON qui n’est pas un .vil', () => {
    expect(() => parseVil('{"a": 1}')).toThrow(VilFormatError);
    expect(() => parseVil('pas du json')).toThrow(VilFormatError);
  });

  it('échappe comme Python (ensure_ascii)', () => {
    expect(stringifyPythonJson({ a: ['é', '▽', 'x"y\n'], b: {} })).toBe(
      '{"a": ["\\u00e9", "\\u25bd", "x\\"y\\n"], "b": {}}',
    );
  });
});
