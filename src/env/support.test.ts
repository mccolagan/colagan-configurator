import { describe, expect, it } from 'vitest';
import { detectHidSupport } from './support';

describe('detectHidSupport', () => {
  it('ok en contexte sécurisé avec WebHID', () => {
    expect(detectHidSupport({ isSecureContext: true, navigator: { hid: {} } })).toBe('ok');
  });

  it('signale un contexte non sécurisé avant tout', () => {
    expect(detectHidSupport({ isSecureContext: false, navigator: {} })).toBe('insecure-context');
  });

  it('signale un navigateur sans WebHID', () => {
    expect(detectHidSupport({ isSecureContext: true, navigator: {} })).toBe('no-webhid');
  });
});
