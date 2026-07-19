import type { SubmissionRequest, StoredReviewJobPayload } from '@ppx/shared';

export function normalizeGithubRepoUrl(value: string): string {
  const candidate = value.trim().replace(/^git\+/, '').replace(/\/+$/, '');
  const url = new URL(candidate);
  if (url.hostname.toLowerCase() !== 'github.com') return candidate;
  const [owner, rawRepo] = url.pathname.split('/').filter(Boolean);
  if (!owner || !rawRepo) return candidate;
  const repo = rawRepo.replace(/\.git$/i, '');
  return `https://github.com/${owner.toLowerCase()}/${repo.toLowerCase()}`;
}

function canonicalPayload(userId: number, input: SubmissionRequest): string {
  return JSON.stringify({
    userId,
    repoUrl: normalizeGithubRepoUrl(input.repoUrl),
    name: input.name.trim(),
    oneLiner: input.oneLiner.trim(),
    subcategoryIds: [...input.subcategoryIds].sort((a, b) => a - b),
    deployMethod: input.deployMethod,
    originalAuthor: input.originalAuthor?.trim() ?? '',
  });
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createSubmissionIdempotencyKey(userId: number, input: SubmissionRequest): Promise<string> {
  return `submission:v1:${await sha256(canonicalPayload(userId, input))}`;
}

export async function scopeClientIdempotencyKey(userId: number, key: string): Promise<string> {
  return `submission:client:${await sha256(`${userId}:${key.trim()}`)}`;
}

export interface SubmissionInsertResult {
  submission: { id: number; status: string };
  created: boolean;
}

export interface IdempotentSubmissionRepository {
  insertOrGet(key: string): Promise<SubmissionInsertResult>;
}

export async function persistIdempotentSubmission(
  repository: IdempotentSubmissionRepository,
  idempotencyKey: string,
): Promise<SubmissionInsertResult> {
  return repository.insertOrGet(idempotencyKey);
}

export function toStoredReviewJob(
  input: SubmissionRequest,
  uploaderUserId: number,
  idempotencyKey: string,
): StoredReviewJobPayload {
  return {
    payloadVersion: 1,
    idempotencyKey,
    repoUrl: normalizeGithubRepoUrl(input.repoUrl),
    name: input.name.trim(),
    oneLiner: input.oneLiner.trim(),
    subcategoryIds: [...input.subcategoryIds].sort((a, b) => a - b),
    deployMethod: input.deployMethod,
    originalAuthor: input.originalAuthor?.trim() ?? '',
    uploaderUserId,
  };
}
