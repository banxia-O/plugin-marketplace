export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  GITHUB_CLIENT_ID: string;
  JWT_SECRET: string;
  GITHUB_CLIENT_SECRET: string;
  REVIEW_SERVICE_SECRET: string;
  REVIEW_SERVICE_URL: string;
  GITHUB_TOKEN?: string;
}

export interface Variables {
  /** 由 authMiddleware 校验 Bearer token 后注入 */
  userId: number;
}

export type AppContext = { Bindings: Env; Variables: Variables };
