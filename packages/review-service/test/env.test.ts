import { describe, expect, it } from 'vitest';
import { requireEnv, reviewSecretsMatch } from '../src/env.js';

describe('review-service environment guards', () => {
  it.each([undefined, '', '   '])('rejects missing required environment values', (value) => {
    expect(() => requireEnv('REVIEW_SERVICE_SECRET', value)).toThrow('REVIEW_SERVICE_SECRET is required');
  });

  it('returns the original configured value', () => {
    expect(requireEnv('REVIEW_SERVICE_SECRET', ' configured-value ')).toBe(' configured-value ');
  });

  it('does not include a configured value in validation errors', () => {
    expect(() => requireEnv('REVIEW_SERVICE_SECRET', '   ')).toThrow(/^REVIEW_SERVICE_SECRET is required$/);
  });

  it.each([
    [undefined, undefined],
    ['', ''],
    ['configured-value', undefined],
    ['configured-value', 'wrong-value'],
  ])('rejects a missing, empty, or incorrect review secret', (configured, provided) => {
    expect(reviewSecretsMatch(configured, provided)).toBe(false);
  });

  it('accepts an exact review secret match', () => {
    expect(reviewSecretsMatch('configured-value', 'configured-value')).toBe(true);
  });
});
