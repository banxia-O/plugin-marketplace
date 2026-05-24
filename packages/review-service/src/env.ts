export interface ReviewEnv {
  PORT: number;
  WORKER_URL: string;        // e.g. https://plugin-marketplace-api.xxx.workers.dev
  REVIEW_SERVICE_SECRET: string;
  DEEPSEEK_API_KEY: string;
  GITHUB_TOKEN: string;      // optional but recommended for higher rate limits
}

export function loadEnv(): ReviewEnv {
  return {
    PORT: Number(process.env['PORT'] ?? 3000),
    WORKER_URL: process.env['WORKER_URL'] ?? '',
    REVIEW_SERVICE_SECRET: process.env['REVIEW_SERVICE_SECRET'] ?? '',
    DEEPSEEK_API_KEY: process.env['DEEPSEEK_API_KEY'] ?? '',
    GITHUB_TOKEN: process.env['GITHUB_TOKEN'] ?? '',
  };
}
