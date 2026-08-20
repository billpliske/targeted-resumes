/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_STORAGE_BACKEND?: 'local' | 'amplify'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
