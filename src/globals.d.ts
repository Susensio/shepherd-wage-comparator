// What the page finds on `window`: the hook for tests.

interface Window {
  /** For tests and the console. */
  app: Record<string, unknown>;
  /** The supabase-js UMD bundle, once loaded (storage/account.js). */
  supabase?: { createClient(url: string, key: string, options?: object): unknown };
}

/** Collapsibles carry their running animations while they fold. */
interface HTMLElement {
  _animating?: boolean;
  _anims?: Animation[] | null;
  _timer?: number;
}
