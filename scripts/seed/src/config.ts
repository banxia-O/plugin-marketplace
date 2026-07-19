export interface SeedConfig {
  workerUrl: string;
  seedUsername: string;
  seedPassword: string;
  githubToken: string;
  minStars: number;
  maxAgeMonths: number;
  dryRun: boolean;
}

export function readSeedConfig(env: NodeJS.ProcessEnv): SeedConfig {
  const dryRun = env['DRY_RUN'] === '1';
  const seedPassword = env['SEED_PASSWORD']?.trim() ?? '';
  if (!dryRun && !seedPassword) {
    throw new Error('SEED_PASSWORD 未配置；非 DRY_RUN 模式拒绝启动');
  }
  return {
    workerUrl: env['WORKER_URL'] ?? 'http://localhost:8787',
    seedUsername: env['SEED_USERNAME'] ?? 'seed-bot',
    seedPassword,
    githubToken: env['GITHUB_TOKEN'] ?? '',
    minStars: Number(env['MIN_STARS'] ?? 50),
    maxAgeMonths: Number(env['MAX_AGE_MONTHS'] ?? 3),
    dryRun,
  };
}
