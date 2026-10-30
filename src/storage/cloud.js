/**
 * Saving to your Claude account. If whoever opens the page can save to it (its owner, or a collaborator), their
 * offers and settings are saved in their private slot of the account (data/users/<id>/estado) and restored on any
 * device. If not (a public link, no session), everything stays in the browser. The most recent wins.
 */

import { closeTemplates, scrollChipsNextPaint, select, templatesOpen } from '../app.js';
import { bundleFromSpanish, normalizeOffer } from '../legacy.js';
import { DEF_CFG } from '../offer.js';
import { KEY, myOffers, onSave, state, store } from '../state.js';
import { fillSettings, paintCloud } from '../views/settings.js';
import { backupText } from './bundle.js';

/** Where the account document lives. Do not change it: saved offers would be lost. */
const docPath = (id) => `data/users/${id}/estado`;

const cloud = {
  ref: null,
  /** The last thing saved: only what differs counts as a change. */
  lastSaved: '',
  timer: 0,
  queue: Promise.resolve(),
};

const notSaving = (reason) => {
  state.cloudReason = reason;
  paintCloud();
};

function upload() {
  const ref = cloud.ref;
  if (!ref) return;
  const data = { offers: myOffers(), cfg: state.config, ts: store.get(KEY.ts, Date.now()) };
  cloud.queue = cloud.queue
    .then(() => ref.set(data))
    .then(() => {
      store.set(KEY.uploaded, true);
      if (!state.inCloud) {
        state.inCloud = true;
        paintCloud();
      }
    })
    .catch((e) => {
      // no permission to save: everything stays in the browser
      cloud.ref = null;
      state.inCloud = false;
      notSaving(`la cuenta no deja guardar: ${e?.code || 'error'}`);
    });
}

/** On every change: one save per batch of changes. */
function changed() {
  const text = backupText();
  if (text === cloud.lastSaved) return;
  cloud.lastSaved = text;
  store.set(KEY.ts, Date.now());
  if (cloud.ref) {
    clearTimeout(cloud.timer);
    cloud.timer = setTimeout(upload, 1500);
  }
}

/** Connects to the account and takes or uploads whichever data is newer. */
export async function startCloud() {
  cloud.lastSaved = backupText();
  onSave(changed);
  try {
    const claude = window.claude;
    if (!claude?.use) return notSaving('abierta fuera de Claude');
    const [user, db] = await Promise.all([claude.use('user'), claude.use('db')]);
    if (!user || !db)
      return notSaving(
        `sin acceso a la cuenta: ${!user ? 'usuario' : ''}${!user && !db ? ' y ' : ''}${!db ? 'datos' : ''}`,
      );
    const id = await user.id();
    if (!id) return notSaving('sin sesión de Claude en esta página');
    const ref = db.doc(docPath(id));
    const snap = await ref.get();
    const saved = snap.exists ? bundleFromSpanish(snap.data()) : null;
    const newer = (Number(saved?.ts) || 0) > store.get(KEY.ts, 0);
    if (Array.isArray(saved?.offers) && saved.offers.length && (!myOffers().length || newer)) {
      // The account's data is newer (or this browser has none): use it. If this browser never saved to the
      // account, its offers are not lost: they are added.
      const notUploaded = store.get(KEY.uploaded, false)
        ? []
        : myOffers().filter((o) => !saved.offers.some((x) => x.id === o.id));
      state.offers = [...saved.offers.map(normalizeOffer), ...notUploaded];
      state.config = { ...DEF_CFG, ...(saved.cfg || {}) };
      store.set(KEY.offers, state.offers);
      store.set(KEY.cfg, state.config);
      store.set(KEY.ts, notUploaded.length ? Date.now() : Number(saved.ts));
      store.set(KEY.uploaded, true);
      cloud.lastSaved = notUploaded.length ? '' : backupText();
      state.placeholderId = null;
      if (templatesOpen()) closeTemplates();
      cloud.ref = ref;
      state.inCloud = true;
      fillSettings();
      scrollChipsNextPaint();
      // with offers not uploaded yet, select saves them, and that uploads them
      select(state.offers.find((o) => o.id === state.activeId)?.id || state.offers[0].id);
      paintCloud();
      return;
    }
    cloud.lastSaved = backupText();
    cloud.ref = ref;
    if (!store.get(KEY.ts, 0)) store.set(KEY.ts, Date.now());
    if (myOffers().length)
      upload(); // this browser's data is the newest
    else notSaving('aún no hay ofertas que guardar');
  } catch (e) {
    notSaving(`error al leer la cuenta: ${e?.code || e?.message || 'desconocido'}`);
  }
}
