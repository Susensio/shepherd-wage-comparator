/**
 * Where the account stands (ADR-0006, ADR-0009, ADR-0011, ADR-0013): who is signed in, the offers waiting for a
 * decision, the profile, the lines the account page shows, and whether other shepherds' offers can be read. No DOM:
 * the UI paints what `view` holds and calls the actions. The status and the availability are derived from the view
 * after every change; each change notifies the listeners once, and a fetch starts from a change, never from a paint.
 */

/**
 * @typedef {{
 *   stage: 'email' | 'code', email: string, busy: boolean, googleFailed: boolean, message: string,
 * }} SignIn
 */

/**
 * @typedef {object} AccountView
 * @property {any} user
 * @property {any} profile
 * @property {any[]} pending the browser's offers whose upload failed
 * @property {string} message the account page's line
 * @property {boolean} messageOk `message` is a success, not a failure
 * @property {boolean} messageIsSignedOutNotice the account page's line shows the sign-out notice (a static text)
 * @property {boolean} signedOutNotice the notice «Tus ofertas siguen guardadas…» is shown
 * @property {string} othersMessage the line in Comparar's section: a failure there is not the account page's business
 * @property {boolean} othersDeclined «Ahora no» in Comparar's section: it shrinks to a button for this visit
 * @property {'share' | 'delete' | null} confirm
 * @property {boolean} enabled accounts are configured: without a project nothing of this shows
 * @property {boolean} started the saved session has been looked at: until then the tooltip would only flash
 * @property {'saved' | 'saving' | 'error'} sync how the background saving goes
 * @property {boolean} offline
 * @property {boolean} tipDismissed the tooltip was sent away with «Ahora no» or a sign-out: gone from every tab for this visit
 * @property {SignIn} signIn
 */

/** @typedef {'connecting' | 'guest' | 'pending' | 'offline' | 'error' | 'saving' | 'online'} AccountStatus */

/**
 * What a listener is told: `account` the view changed, `status` only the background saving, `others` what Comparar
 * shows of other shepherds' offers (availability, loading, result), `replaced` the account's copy has replaced the
 * browser's, `signedIn` a sign-in is complete.
 * @typedef {'account' | 'status' | 'others' | 'replaced' | 'signedIn'} AccountEvent
 */

const freshSignIn = (googleFailed = false) =>
  /** @type {SignIn} */ ({ stage: 'email', email: '', busy: false, googleFailed, message: '' });

/**
 * @param {object} deps
 * @param {boolean} deps.enabled a project is configured
 * @param {{
 *   start(hooks: import('./storage/account.js').AccountHooks): Promise<any>,
 *   open(hooks: import('./storage/account.js').AccountHooks): Promise<any>,
 * }} deps.loader the account behind the page (`createAccountLoader`)
 * @param {{ available: boolean, include: boolean, status: string, items: any[], viewId: string | null }} deps.others
 *   `state.others`: written here, read by Comparar
 * @param {(shared: any) => any} deps.ingestShared
 * @param {() => boolean} [deps.isOnline]
 * @param {() => boolean} [deps.wantsOthers] Comparar is in view: availability then fetches at once
 * @param {() => void} [deps.forgetGoogleChoice] a sign-out or a deletion
 */
export function createAccountState({
  enabled,
  loader,
  others,
  ingestShared,
  isOnline = () => true,
  wantsOthers = () => false,
  forgetGoogleChoice = () => {},
}) {
  /** @type {AccountView} */
  const view = {
    user: null,
    profile: null,
    pending: [],
    message: '',
    messageOk: false,
    messageIsSignedOutNotice: false,
    signedOutNotice: false,
    othersMessage: '',
    othersDeclined: false,
    confirm: null,
    enabled: false,
    started: false,
    sync: 'saved',
    offline: false,
    tipDismissed: false,
    signIn: freshSignIn(),
  };
  /** @type {any} */
  let account = null;
  let loadSeq = 0;
  const listeners = new Set();

  /** @param {AccountEvent} event */
  const emit = (event) => {
    for (const listener of listeners) listener(event);
  };

  /** Where the account stands, as the dot on its button shows it. */
  function status() {
    if (!view.started) return 'connecting';
    if (!view.user) return 'guest';
    if (view.pending.length) return 'pending';
    if (view.offline) return 'offline';
    if (view.sync === 'error') return 'error';
    return view.sync === 'saving' ? 'saving' : 'online';
  }

  /** Other shepherds' offers can be read only when signed in with sharing on (ADR-0006). */
  const sharingAvailable = () => !!(view.user && view.profile?.sharing && !view.pending.length);

  /** Fetches the others' offers into `others` (memory only); the latest request wins. */
  async function loadOthers() {
    if (!account || !others.available) return;
    const seq = ++loadSeq;
    others.status = 'loading';
    emit('others');
    let result = 'ready';
    let items = [];
    try {
      items = (await account.sharedOffers()).map(ingestShared).filter(Boolean);
    } catch (error) {
      console.error(error);
      result = 'error';
    }
    if (seq !== loadSeq || !others.available) return;
    others.status = result;
    if (result === 'ready') {
      others.items = items;
      if (!items.some((x) => x.o.id === others.viewId)) others.viewId = null;
    }
    emit('others');
  }

  /** Every change to the view ends here: the derived availability follows, then the listeners hear of it once. */
  function changed() {
    const available = sharingAvailable();
    if (available !== others.available) {
      others.available = available;
      if (available)
        others.include = true; // sharing means seeing the others, until hidden with the checkbox
      else Object.assign(others, { include: false, status: 'idle', items: [], viewId: null });
      emit('others');
      if (available && wantsOthers()) loadOthers(); // else showTab loads on arrival
    }
    emit('account');
  }

  /** @type {import('./storage/account.js').AccountHooks} */
  const hooks = {
    onReplaced: () => emit('replaced'),
    onStatus(sync) {
      view.sync = sync;
      emit('status');
    },
  };

  /**
   * Runs an account call; its failure becomes `failure`, a short line, never an alert. `line`: «message» (the account
   * page), «othersMessage» (Comparar's section) or «signIn» (under the sign-in choices, busy while it runs).
   * @param {string} failure
   * @param {() => Promise<void>} call
   * @param {'message' | 'othersMessage' | 'signIn'} [line]
   */
  async function attempt(failure, call, line = 'message') {
    const signingIn = line === 'signIn';
    // connect() replaces view.signIn, so the line is looked up each time
    const write = (/** @type {string} */ text) => {
      if (signingIn) view.signIn.message = text;
      else view[line] = text;
    };
    write('');
    if (line === 'message') {
      view.messageOk = false;
      view.messageIsSignedOutNotice = false;
    }
    if (signingIn) {
      view.signIn.busy = true;
      changed();
    }
    try {
      await call();
    } catch (error) {
      console.error(error);
      write(failure);
    }
    if (signingIn) view.signIn.busy = false;
    changed();
  }

  /** Takes a connected account: the signed-in user, the offers waiting for a decision, and the profile. */
  async function enter(started) {
    view.signedOutNotice = false;
    account = started.account;
    view.user = started.user;
    view.pending = started.pending;
    view.profile = null;
    if (view.user && !view.pending.length) view.profile = await account.profile();
  }

  /** Signed in by whatever way: read the account, upload this browser's offers, show who is in. */
  async function connect(opened) {
    await enter({ account: opened, ...(await opened.connect()) });
    if (!view.pending.length) emit('signedIn'); // offers waiting for a decision keep the page open
    view.signIn = freshSignIn(view.signIn.googleFailed);
  }

  /**
   * Signing out or deleting the account: no tooltip on any tab for this visit. `keptInAccount`: the offers were cleared
   * from the browser but remain in the account, which the welcome says.
   */
  function signedOut({ keptInAccount = false } = {}) {
    forgetGoogleChoice();
    view.tipDismissed = true;
    view.signedOutNotice = keptInAccount;
    view.message = '';
    view.messageIsSignedOutNotice = keptInAccount;
    view.messageOk = keptInAccount;
    Object.assign(view, { user: null, profile: null, pending: [], confirm: null });
  }

  /** Turns sharing on or off through the account; a failure goes to `line`. */
  const setSharing = (/** @type {boolean} */ on, /** @type {'message' | 'othersMessage'} */ line) =>
    attempt(
      on
        ? 'No se pudieron compartir tus ofertas. Inténtalo de nuevo.'
        : 'No se pudo dejar de compartir. Inténtalo de nuevo.',
      async () => {
        view.profile = await account.updateProfile({ sharing: on });
        view.confirm = null;
        if (!on) view.othersDeclined = false;
      },
      line,
    );

  const signInFailure = 'No se pudo entrar. Inténtalo de nuevo.';
  const codeFailure = 'No se pudo enviar el código. Inténtalo de nuevo.';

  return {
    view,
    status,
    /** Called with an `AccountEvent` after each change. */
    subscribe: (/** @type {(event: AccountEvent) => void} */ listener) => listeners.add(listener),
    loadOthers,

    /** Called once at startup. With no project configured nothing happens. Resolves when the saved session is looked at. */
    async start() {
      if (!enabled) return;
      view.enabled = true;
      view.offline = !isOnline();
      changed();
      await attempt('No se pudo conectar con la cuenta.', async () => {
        try {
          const started = await loader.start(hooks);
          if (started) await enter(started);
        } finally {
          view.started = true;
        }
      });
    },

    setOnline(/** @type {boolean} */ online) {
      view.offline = !online;
      if (online) account?.changed(); // what failed while offline is written now
      changed();
    },

    /** Google's button handed over an ID token (ADR-0009). */
    signInWithGoogleToken: (/** @type {string} */ token, /** @type {string} */ nonce) =>
      attempt(signInFailure, async () => {
        const opened = await loader.open(hooks);
        await opened.signInWithGoogleToken(token, nonce);
        await connect(opened);
      }),

    /** Google's script did not load: the plain button replaces it. */
    googleFailed() {
      view.signIn.googleFailed = true;
      changed();
    },

    /** The fallback when Google's script does not load: the browser leaves for Google and comes back signed in. */
    signIn: () => attempt(signInFailure, async () => (await loader.open(hooks)).signIn(), 'signIn'),

    sendEmailCode: (/** @type {string} */ email) =>
      attempt(
        'No se pudo enviar el código. Revisa la dirección e inténtalo de nuevo.',
        async () => {
          await (await loader.open(hooks)).sendEmailCode(email);
          Object.assign(view.signIn, { stage: 'code', email });
        },
        'signIn',
      ),

    resendEmailCode: () =>
      attempt(
        codeFailure,
        async () => {
          await (await loader.open(hooks)).sendEmailCode(view.signIn.email);
          view.signIn.message = 'Se ha enviado otro código.';
        },
        'signIn',
      ),

    /** @param {string} typed what was typed, with whatever separators */
    verifyEmailCode(typed) {
      const code = typed.replace(/\D/g, '');
      if (code.length !== 6) {
        view.signIn.message = 'El código tiene 6 cifras.';
        changed();
        return Promise.resolve();
      }
      return attempt(
        'El código no es correcto o ha caducado. Revísalo o pide otro.',
        async () => {
          const opened = await loader.open(hooks);
          await opened.verifyEmailCode(view.signIn.email, code);
          await connect(opened);
        },
        'signIn',
      );
    },

    changeSignInEmail() {
      Object.assign(view.signIn, { stage: 'email', message: '' });
      changed();
    },

    dismissTip() {
      view.tipDismissed = true;
      changed();
    },

    signOut: () =>
      attempt('No se pudo salir. Inténtalo de nuevo.', async () => {
        await account.signOut();
        signedOut({ keptInAccount: true });
      }),

    uploadPending: () =>
      attempt('No se pudieron subir las ofertas. Inténtalo de nuevo.', async () => {
        await account.uploadPending();
        view.pending = [];
        view.profile = await account.profile();
      }),

    discardPending: () =>
      attempt('No se pudo cargar la cuenta.', async () => {
        account.discardPending();
        view.pending = [];
        view.profile = await account.profile();
      }),

    saveProfile: (/** @type {{ name: string | null, email: string | null, phone: string | null }} */ fields) =>
      attempt('No se pudo guardar el perfil.', async () => {
        view.profile = await account.updateProfile(fields);
        view.message = 'Perfil guardado.';
        view.messageOk = true;
      }),

    confirmShare: () => setSharing(true, 'message'),
    shareFromCompare: () => setSharing(true, 'othersMessage'),
    stopSharing: () => setSharing(false, 'othersMessage'),

    /** The sharing switch: turning it on asks first; turning it off acts at once. */
    toggleSharing(/** @type {boolean} */ checked) {
      if (!checked) return setSharing(false, 'message');
      view.confirm = 'share';
      changed();
      return Promise.resolve();
    },

    declineShare() {
      view.othersDeclined = true;
      changed();
    },
    reopenShare() {
      view.othersDeclined = false;
      changed();
    },
    cancelShare() {
      view.confirm = null;
      changed();
    },

    askDeleteAccount() {
      view.confirm = 'delete';
      changed();
    },
    cancelDeleteAccount() {
      view.confirm = null;
      changed();
    },
    deleteAccount: () =>
      attempt('No se pudo borrar la cuenta. Inténtalo de nuevo.', async () => {
        await account.deleteAccount();
        signedOut();
      }),
  };
}
