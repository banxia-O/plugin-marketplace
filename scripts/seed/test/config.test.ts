import { describe, expect, it } from 'vitest';
import { readSeedConfig } from '../src/config.js';

describe('seed credentials', () => {
  it('fails closed without a password outside dry-run', () => {
    expect(() => readSeedConfig({})).toThrow(/SEED_PASSWORD/);
  });

  it('does not require a password in dry-run', () => {
    expect(readSeedConfig({ DRY_RUN: '1' }).seedPassword).toBe('');
  });

  it('uses only an explicitly supplied password', () => {
    expect(readSeedConfig({ SEED_PASSWORD: 'rotated-value' }).seedPassword).toBe('rotated-value');
  });
});
