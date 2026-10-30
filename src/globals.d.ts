// What the page finds on `window`: the claude.ai runtime, when published there, and the hook for tests.

interface ClaudeRuntime {
  // biome-ignore lint/suspicious/noExplicitAny: each capability (db, user, downloads) has its own shape
  use(capability: string): Promise<any>;
}

interface Window {
  /** Present when the page runs as a claude.ai artifact. */
  claude?: ClaudeRuntime;
  /** For tests and the console. */
  app: Record<string, unknown>;
}

/** Collapsibles carry their running animations while they fold. */
interface HTMLElement {
  _animating?: boolean;
  _anims?: Animation[] | null;
  _timer?: number;
}
