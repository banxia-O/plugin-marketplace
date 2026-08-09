import { createHash, timingSafeEqual } from 'node:crypto';

export interface ReviewEnv {
  PORT: number;
  WORKER_URL: string;        // e.g. https://plugin-marketplace-api.xxx.workers.dev
  REVIEW_SERVICE_SECRET: string;
  DEEPSEEK_API_KEY: string;
  GITHUB_TOKEN: string;      // optional but recommended for higher rate limits
}

export function requireEnv(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) throw new Error(`${name} is required`);
  return value;
}

export function reviewSecretsMatch(configured: string | undefined, provided: string | undefined): boolean {
  if (!configured || configured.trim().length === 0 || !provided || provided.trim().length === 0) return false;
  const expectedHash = createHash('sha256').update(configured).digest();
  const providedHash = createHash('sha256').update(provided).digest();
  return timingSafeEqual(expectedHash, providedHash);
}

export function loadEnv(): ReviewEnv {
  return {
    PORT: Number(process.env['PORT'] ?? 3000),
    WORKER_URL: requireEnv('WORKER_URL', process.env['WORKER_URL']),
    REVIEW_SERVICE_SECRET: requireEnv('REVIEW_SERVICE_SECRET', process.env['REVIEW_SERVICE_SECRET']),
    DEEPSEEK_API_KEY: requireEnv('DEEPSEEK_API_KEY', process.env['DEEPSEEK_API_KEY']),
    GITHUB_TOKEN: process.env['GITHUB_TOKEN'] ?? '',
  };
}
