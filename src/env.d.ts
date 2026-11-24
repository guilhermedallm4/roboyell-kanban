interface ImportMetaEnv {
  /** "true" switches login to the browser-only mode used on GitHub Pages. */
  readonly VITE_STATIC_AUTH?: string;
  /** "owner/repo" that holds data/board.json (default guilhermedallm4/roboyell-kanban). */
  readonly VITE_SYNC_REPO?: string;
  readonly VITE_SYNC_BRANCH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
