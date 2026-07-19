import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ReviewResultPayload } from '@ppx/shared';

interface Fixture {
  legacyAccepted: unknown[];
  newTechnicalFailure: unknown;
}

function legacyWorkerAccepts(value: unknown): boolean {
  const callback = value as { status?: string; submissionId?: number; plugin?: unknown; rejectReason?: unknown };
  if (typeof callback.submissionId !== 'number') return false;
  if (callback.status === 'done') return callback.plugin !== undefined;
  if (callback.status === 'rejected') return typeof callback.rejectReason === 'string';
  return false;
}

describe('rolling callback contract', () => {
  it('documents that the legacy Worker rejects the new failed callback', () => {
    const fixture = JSON.parse(readFileSync(new URL('./fixtures/callback-contracts.json', import.meta.url), 'utf8')) as Fixture;
    expect(fixture.legacyAccepted.every(legacyWorkerAccepts)).toBe(true);
    expect(legacyWorkerAccepts(fixture.newTechnicalFailure)).toBe(false);
    expect(ReviewResultPayload.safeParse(fixture.newTechnicalFailure).success).toBe(true);
  });
});
