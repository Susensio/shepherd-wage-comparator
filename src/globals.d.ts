// What the page finds on `window`: the hook for tests.

interface Window {
  /** For tests and the console. */
  app: Record<string, unknown>;
  /** The supabase-js UMD bundle, once loaded (storage/account.js). */
  supabase?: { createClient(url: string, key: string, options?: object): unknown };
  /** Google Identity Services, once loaded (storage/google-sign-in.js). */
  google?: { accounts?: { id?: GoogleId } };
}

/** The part of Google Identity Services' `google.accounts.id` the page calls. */
interface GoogleId {
  initialize(options: {
    client_id: string;
    nonce: string;
    callback(response: { credential: string }): void;
    use_fedcm_for_prompt?: boolean;
    itp_support?: boolean;
    context?: string;
  }): void;
  renderButton(parent: HTMLElement, options: object): void;
  prompt(): void;
  disableAutoSelect(): void;
}

/** Collapsibles carry their running animations while they fold. */
interface HTMLElement {
  _animating?: boolean;
  _anims?: Animation[] | null;
  _timer?: number;
}
