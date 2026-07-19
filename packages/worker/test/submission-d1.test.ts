import { afterEach, describe, expect, it } from 'vitest';
import type { ReviewPluginData, StoredReviewJobPayload } from '@ppx/shared';
import {
  ActiveSubmissionConflictError,
  completeSubmissionWithPlugin,
  findSubmissionById,
  IdempotencyConflictError,
  insertSubmission,
  transitionSubmissionStatus,
} from '../src/db.js';
import { createMigratedTestD1, createOldTestD1 } from './helpers/d1.js';

const disposers: Array<() => Promise<void>> = [];
afterEach(async () => Promise.all(disposers.splice(0).map((dispose) => dispose())));

function job(key: string, name = 'Plugin'): StoredReviewJobPayload {
  return {
    payloadVersion: 1,
    idempotencyKey: key,
    repoUrl: 'https://github.com/example/plugin',
    name,
    oneLiner: 'Plugin description',
    subcategoryIds: [1, 2],
    deployMethod: 'remote',
    originalAuthor: 'example',
    uploaderUserId: 1,
  };
}

function plugin(): ReviewPluginData {
  return {
    slug: 'example-plugin',
    name: 'Plugin',
    oneLiner: 'Plugin description',
    descriptionMd: '# Plugin',
    repoUrl: 'https://github.com/example/plugin',
    agentMd: null,
    agentMdStatus: 'incomplete',
    deployMethod: 'remote',
    supportedPlatforms: [],
    license: 'MIT',
    originalAuthor: 'example',
    originalAuthorUrl: 'https://github.com/example',
    stars: 1,
    lastRepoUpdate: null,
    reviewStatus: 'basic',
    subcategoryIds: [1, 2],
    uploaderUserId: 1,
  };
}

describe('D1 submission invariants', () => {
  it('atomically allows only one active submission for a normalized repo', async () => {
    const testD1 = await createMigratedTestD1();
    disposers.push(testD1.dispose);
    const attempts = await Promise.allSettled([
      insertSubmission(testD1.db, { repoUrl: job('one').repoUrl, uploaderUserId: 1, idempotencyKey: 'one', payload: job('one') }),
      insertSubmission(testD1.db, { repoUrl: 'https://github.com/Example/Plugin.git/', uploaderUserId: 1, idempotencyKey: 'two', payload: job('two') }),
    ]);
    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = attempts.find((result) => result.status === 'rejected');
    expect(rejected).toMatchObject({ reason: expect.any(ActiveSubmissionConflictError) });
  });

  it('rejects reuse of an idempotency key for a different payload', async () => {
    const testD1 = await createMigratedTestD1();
    disposers.push(testD1.dispose);
    await insertSubmission(testD1.db, { repoUrl: job('same').repoUrl, uploaderUserId: 1, idempotencyKey: 'same', payload: job('same') });
    await expect(insertSubmission(testD1.db, {
      repoUrl: job('same', 'Different').repoUrl,
      uploaderUserId: 1,
      idempotencyKey: 'same',
      payload: job('same', 'Different'),
    })).rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  it('preflight detects normalized active-repo duplicates before the unique index', async () => {
    const testD1 = await createOldTestD1();
    disposers.push(testD1.dispose);
    await testD1.db.prepare("INSERT INTO submissions (repo_url, uploader_user_id, status) VALUES ('https://github.com/Example/Plugin', 1, 'queued'), ('https://github.com/example/plugin.git/', 1, 'processing')").run();
    const preflight = await import('../src/migration-preflight.js');
    expect(await preflight.findActiveRepoConflicts(testD1.db)).toEqual([
      expect.objectContaining({ activeRepoKey: 'https://github.com/example/plugin', count: 2 }),
    ]);
  });

  it('recovers missing categories for an existing plugin and completes idempotently', async () => {
    const testD1 = await createMigratedTestD1();
    disposers.push(testD1.dispose);
    const inserted = await insertSubmission(testD1.db, {
      repoUrl: job('done').repoUrl,
      uploaderUserId: 1,
      idempotencyKey: 'done',
      payload: job('done'),
    });
    await testD1.db.prepare("UPDATE submissions SET status = 'processing', attempt_count = 1 WHERE id = ?").bind(inserted.submission.id).run();
    await testD1.db.prepare(`INSERT INTO plugins
      (name, slug, one_liner, description_md, repo_url, deploy_method, license, original_author, uploader_user_id)
      VALUES ('Plugin', 'example-plugin', 'Plugin description', '# Plugin', ?, 'remote', 'MIT', 'example', 1)`)
      .bind(job('done').repoUrl)
      .run();
    const submission = (await findSubmissionById(testD1.db, inserted.submission.id))!;

    expect(await completeSubmissionWithPlugin(testD1.db, submission, plugin(), 1)).toMatchObject({ deduplicated: false });
    expect((await testD1.db.prepare('SELECT * FROM plugin_categories').all()).results).toHaveLength(2);
    expect((await findSubmissionById(testD1.db, inserted.submission.id))?.status).toBe('done');
    expect(await completeSubmissionWithPlugin(testD1.db, submission, plugin(), 1)).toMatchObject({ deduplicated: true });
  });

  it('does not publish a plugin when completion loses a terminal-state race', async () => {
    const testD1 = await createMigratedTestD1();
    disposers.push(testD1.dispose);
    const inserted = await insertSubmission(testD1.db, {
      repoUrl: job('race').repoUrl,
      uploaderUserId: 1,
      idempotencyKey: 'race',
      payload: job('race'),
    });
    await testD1.db.prepare("UPDATE submissions SET status = 'processing', attempt_count = 1 WHERE id = ?").bind(inserted.submission.id).run();
    const stale = (await findSubmissionById(testD1.db, inserted.submission.id))!;
    await testD1.db.prepare("UPDATE submissions SET status = 'rejected', active_repo_key = NULL WHERE id = ?").bind(inserted.submission.id).run();

    await expect(completeSubmissionWithPlugin(testD1.db, stale, plugin(), 1)).rejects.toThrow(/state conflict/i);
    expect((await testD1.db.prepare('SELECT * FROM plugins').all()).results).toHaveLength(0);
    expect((await testD1.db.prepare('SELECT * FROM plugin_categories').all()).results).toHaveLength(0);
  });

  it('releases the active repo key on terminal transition', async () => {
    const testD1 = await createMigratedTestD1();
    disposers.push(testD1.dispose);
    const first = await insertSubmission(testD1.db, { repoUrl: job('first').repoUrl, uploaderUserId: 1, idempotencyKey: 'first', payload: job('first') });
    expect(await transitionSubmissionStatus(testD1.db, first.submission.id, 'queued', 'failed')).toBe(true);
    await expect(insertSubmission(testD1.db, { repoUrl: job('second').repoUrl, uploaderUserId: 1, idempotencyKey: 'second', payload: job('second') })).resolves.toMatchObject({ created: true });
  });
});
