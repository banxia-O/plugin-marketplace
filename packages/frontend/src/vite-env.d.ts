/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API 基础地址；留空走同源 /api。 */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
