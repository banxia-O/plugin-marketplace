import { afterEach, describe, expect, it, vi } from 'vitest';
import { createD1DispatchRepository, dispatchDueReviews, dispatchReviewJob } from '../src/dispatch.js';
import type { StoredReviewJobPayload } from '@ppx/shared';
import { createMigratedTestD1 } from './helpers/d1.js';

const disposers: Array<() => Promise<void>> = [];
afterEach(async () => Promise.all(disposers.splice(0).map((dispose) => dispose())));

function payload(key = 'lease-key'): StoredReviewJobPayload {
  return {
    payloadVersion: 1,
    idempotencyKey: key,
    repoUrl: `https://github.com/example/${key}`,
    name: 'Lease test',
    oneLiner: 'Lease test plugin',
    subcategoryIds: [1],
    deployMethod: 'remote',
    originalAuthor: 'example',
    uploaderUserId: 1,
  };
}

async function insertQueued(db: D1Database, maxAttempts = 3): Promise<number> {
  const job = payload();
  const row = await db.prepare(`INSERT INTO submissions
    (repo_url, uploader_user_id, payload_version, job_payload_json, idempotency_key, active_repo_key, max_attempts, next_attempt_at)
    VALUES (?, 1, 1, ?, ?, ?, ?, datetime('now')) RETURNING id`)
    .bind(job.repoUrl, JSON.stringify(job), job.idempotencyKey, job.repoUrl, maxAttempts)
    .first<{ id: number }>();
  return row!.id;
}

describe('dispatch lease recovery', () => {
  it('reclaims an expired dispatch lease but not a live lease', async () => {
    const testD1 = await createMigratedTestD1();
    disposers.push(testD1.dispose);
    const id = await insertQueued(testD1.db);
    const repository = createD1DispatchRepository(testD1.db);

    expect((await repository.claim(id))?.attemptCount).toBe(1);
    expect(await repository.claim(id)).toBeNull();

    await testD1.db.prepare("UPDATE submissions SET next_attempt_at = datetime('now', '-1 minute') WHERE id = ?").bind(id).run();
    expect((await repository.claim(id))?.attemptCount).toBe(2);
  });

  it('recovers after markProcessing throws and eventually completes on a new attempt', async () => {
    const testD1 = await createMigratedTestD1();
    disposers.push(testD1.dispose);
    const id = await insertQueued(testD1.db);
    const repository = createD1DispatchRepository(testD1.db);
    const brokenRepository = { ...repository, markProcessing: vi.fn().mockRejectedValue(new Error('D1 unavailable')) };

    await expect(dispatchReviewJob(id, {
      repository: brokenRepository,
      send: vi.fn().mockResolvedValue(new Response('', { status: 202 })),
      reviewServiceUrl: 'https://review.example',
      reviewSecret: 'placeholder',
    })).rejects.toThrow('D1 unavailable');

    const stuck = await testD1.db.prepare('SELECT status, attempt_count, next_attempt_at FROM submissions WHERE id = ?').bind(id).first<{ status: string; attempt_count: number; next_attempt_at: string | null }>();
    expect(stuck).toMatchObject({ status: 'dispatching', attempt_count: 1 });
    expect(stuck?.next_attempt_at).not.toBeNull();

    await testD1.db.prepare("UPDATE submissions SET next_attempt_at = datetime('now', '-1 minute') WHERE id = ?").bind(id).run();
    await dispatchReviewJob(id, {
      repository,
      send: vi.fn().mockResolvedValue(new Response('', { status: 202 })),
      reviewServiceUrl: 'https://review.example',
      reviewSecret: 'placeholder',
    });
    expect(await testD1.db.prepare('SELECT status, attempt_count FROM submissions WHERE id = ?').bind(id).first()).toMatchObject({
      status: 'processing',
      attempt_count: 2,
    });
  });

  it('dead-letters an expired dispatch lease after max attempts', async () => {
    const testD1 = await createMigratedTestD1();
    disposers.push(testD1.dispose);
    const id = await insertQueued(testD1.db, 1);
    await createD1DispatchRepository(testD1.db).claim(id);
    await testD1.db.prepare("UPDATE submissions SET next_attempt_at = datetime('now', '-1 minute') WHERE id = ?").bind(id).run();

    await dispatchDueReviews(testD1.db, {
      send: vi.fn(),
      reviewServiceUrl: 'https://review.example',
      reviewSecret: 'placeholder',
    });
    expect(await testD1.db.prepare('SELECT status FROM submissions WHERE id = ?').bind(id).first()).toMatchObject({ status: 'dead_letter' });
  });

  it('does not silently accept a stale mark operation', async () => {
    const testD1 = await createMigratedTestD1();
    disposers.push(testD1.dispose);
    const id = await insertQueued(testD1.db);
    const repository = createD1DispatchRepository(testD1.db);
    const claimed = await repository.claim(id);
    await testD1.db.prepare("UPDATE submissions SET status = 'processing' WHERE id = ?").bind(id).run();
    await expect(repository.markRetry(id, claimed!.attemptCount, 'test', 'test', new Date().toISOString())).rejects.toThrow(/state conflict/i);
  });
});
