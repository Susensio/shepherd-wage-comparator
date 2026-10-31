/**
 * Google's own sign-in button and account chooser (Google Identity Services, ADR-0009). Google signs an ID token for
 * the page's origin, so its screens name this page instead of the Supabase project; the token goes to Supabase with
 * `signInWithIdToken`. The script is loaded only when a sign-in button is about to show.
 */

/** In Spanish: `locale` on the button alone is not always followed. */
const SCRIPT = 'https://accounts.google.com/gsi/client?hl=es';

/** @type {Promise<any> | null} */
let loading = null;
/** The nonce of this page load: its hash goes to Google, the raw value to Supabase, which compares them. */
let nonce = '';
/** Who gets the next token. */
let onToken = (_token, _nonce) => {};

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function loadScript() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onload = () =>
      window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error('no gsi'));
    script.onerror = () => reject(new Error("Google's sign-in script did not load"));
    document.head.append(script);
  });
}

/** Google's `accounts.id`, initialized once per page load. Rejects when the script cannot load. */
function ready(clientId) {
  loading ??= (async () => {
    const id = await loadScript();
    nonce = crypto.randomUUID();
    id.initialize({
      client_id: clientId,
      nonce: await sha256Hex(nonce),
      callback: (/** @type {{ credential: string }} */ response) => onToken(response.credential, nonce),
      use_fedcm_for_prompt: true,
      itp_support: true,
      context: 'signin',
    });
    return id;
  })().catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}

/** Google's dark button in dark mode: the page's `data-theme` where the CSS uses it, else the system's scheme. */
function buttonTheme() {
  const forced = document.documentElement.dataset.theme;
  const dark = forced ? forced === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  return dark ? 'filled_black' : 'outline';
}

/**
 * Draws Google's button into every slot that has none, or one in the other theme, and with `chooser` opens Google's
 * account chooser. `handler` gets the ID token and the raw nonce.
 * @param {{ clientId: string, slots: HTMLElement[], handler: (token: string, nonce: string) => void, chooser?: boolean }} options
 */
export async function showGoogleButtons({ clientId, slots, handler, chooser = false }) {
  const id = await ready(clientId);
  onToken = handler;
  const theme = buttonTheme();
  for (const slot of slots) {
    if (slot.childElementCount && slot.dataset.buttonTheme === theme) continue;
    slot.replaceChildren();
    slot.dataset.buttonTheme = theme;
    id.renderButton(slot, {
      type: 'standard',
      theme,
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      locale: 'es',
      width: Math.min(320, slot.clientWidth || 320),
    });
  }
  if (chooser) id.prompt();
}

/** After a sign-out: Google stops picking the account without asking. */
export function forgetGoogleChoice() {
  window.google?.accounts?.id?.disableAutoSelect();
}
