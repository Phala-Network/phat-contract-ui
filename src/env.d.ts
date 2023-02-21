/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_BRANCH_NAME: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}