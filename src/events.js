/** Events: the offer form's steps, «Datos comunes», collapsibles, and every button, by its data-action. */

import { animateNextPaint, commit, fillVacation, openOffer, paintAll, select, show, viewShared } from './app.js';
import { $ } from './dom.js';
import { fInputValue, num } from './format.js';
import { DAYS_PER_MONTH, DEF_CFG, defaultVacation, HERD, isoOf, missing, newId, parseDate, sideOf } from './offer.js';
import { offers } from './offers.js';
import { answersOf, toAnswerable, writeAnswers } from './pay-answers.js';
import { active, calcOffer, myOffers, saveCmpUnit, saveConfig, state } from './state.js';
import { snoozeReminder } from './storage/bundle.js';
import { cardText, claimText, legalLine } from './text.js';
import { accountActions, loadOthers, onSharingToggled } from './ui/account-section.js';
import { copyBackup, downloadBackup, loadBackup } from './ui/backup.js';
import { copyText } from './ui/dom.js';
import { back, close, editStep, next, pickTemplate, startEntry, stepOfMissing } from './ui/entry.js';
import { saveFold } from './ui/folds.js';
import { scrollToElement, toggleFold } from './ui/motion.js';
import {
  closeFicha,
  closePage,
  fichaOpen,
  leaveFicha,
  onPopState,
  openAccountPage,
  openSettingsPage,
  showTab,
} from './ui/navigation.js';
import { setUpOfferMenu } from './ui/offer-menu.js';
import { changePlace } from './ui/place-field.js';
import { paintBackup } from './ui/settings-page.js';
import { fillForm, form, paintEnd } from './views/form.js';
import { stepPayslipMonth } from './views/season-end.js';
import { fillSettings } from './views/settings.js';

/* --- The offer form --- */

/**
 * The end date becomes a duration in days, counted from the start; without a start, it sets the start from the
 * duration. Returns whether something changed.
 */
function endDateTyped(value) {
  const { terms } = active();
  if (!value) return false;
  const end = parseDate(value);
  if (terms.start) {
    const days = Math.round((+end - +parseDate(terms.start)) / 864e5) + 1;
    if (days < 1) return false;
    terms.duration = days;
    terms.durationUnit = 'days';
    return true;
  }
  if (num(terms.duration) > 0 && terms.durationUnit !== 'unknown') {
    const days =
      terms.durationUnit === 'days'
        ? Math.round(num(terms.duration))
        : Math.round(num(terms.duration) * DAYS_PER_MONTH);
    const start = new Date(end);
    start.setDate(start.getDate() - days + 1);
    terms.start = isoOf(start);
    return true;
  }
  return false;
}

/** Reads what changed in «Pago» into the terms, through the answers they give. */
function payAnswerTyped(el, terms) {
  const answers = answersOf(terms);
  const amount = el.value.trim() === '' ? '' : num(el.value);
  if (el.dataset.answer === 'amount') answers.amount = amount;
  else if (el.dataset.answer === 'part') answers.part = amount;
  else if (el.dataset.answer === 'unit') answers.unit = /** @type {'day' | 'month' | 'total'} */ (el.value);
  else {
    answers.payroll = /** @type {'all' | 'min' | 'part' | 'none'} */ (el.value);
    // The part starts empty, as a payslip amount told about everything is not a part of it
    if (answers.payroll === 'part') Object.assign(answers, { part: '', partType: 'net' });
  }
  writeAnswers(terms, answers);
}

function onFormInput(e) {
  const el = /** @type {HTMLInputElement} */ (e.target);
  const o = active();
  const { terms } = o;
  if (el.dataset.answer) {
    payAnswerTyped(el, terms);
    animateNextPaint();
    if (defaultVacation(terms)) fillVacation(o);
    commit();
    return;
  }
  if (el.id === 'end') {
    if (!endDateTyped(el.value)) return;
    animateNextPaint();
    defaultVacation(terms);
    fillForm(o);
    commit();
    return;
  }
  if (!el.name) return;
  const side = sideOf(o, el.name);
  if (el.type === 'radio' && el.name === 'durationUnit') {
    // Changing the unit converts the duration: 4 months ↔ 122 days
    if (el.checked && el.value !== terms.durationUnit && el.value !== 'unknown' && terms.durationUnit !== 'unknown') {
      const v = num(terms.duration);
      terms.duration =
        el.value === 'days' ? Math.round(v * DAYS_PER_MONTH) : Math.round((v / DAYS_PER_MONTH) * 10) / 10;
      /** @type {HTMLInputElement} */ ($('#duration')).value = fInputValue(terms.duration, terms.duration % 1 ? 1 : 0);
    }
    if (el.checked) terms.durationUnit = el.value;
    // Without a duration «en total» is a month: the only edit that can leave the pay in a shape the questions cannot say
    toAnswerable(o, { cfg: state.config, offers: myOffers() });
  } else if (el.type === 'radio') {
    if (el.checked) side[el.name] = el.value;
  } else if (el.type === 'checkbox') side[el.name] = el.checked;
  else if (el.type === 'date') side[el.name] = el.value;
  else if (el.name === 'name') side.name = el.value;
  else if (el.name === 'rentValue' && el.value.trim() === '')
    side.rentValue = ''; // empty: the one in «Datos comunes»
  else if (HERD.some(([field]) => field === el.name) && el.value.trim() === '')
    side[el.name] = ''; // no head count
  else side[el.name] = num(el.value);
  animateNextPaint();
  if (el.name === 'vacation') delete terms.vacationAuto;
  if (defaultVacation(terms)) fillVacation(o);
  if (['start', 'duration', 'durationUnit'].includes(el.name)) paintEnd(terms);
  commit();
}

/** An empty name does not leave the offer without one. */
function onFormFocusOut(e) {
  const el = /** @type {HTMLInputElement} */ (e.target);
  const o = active();
  if (el.name !== 'name' || o.mine.name.trim()) return;
  o.mine.name = `Oferta ${state.offers.indexOf(o) + 1}`;
  el.value = o.mine.name;
  commit();
}

/* --- «Datos comunes» and the assumptions: they apply to every offer --- */

function onSettingsInput(e) {
  const el = /** @type {HTMLInputElement} */ (e.target);
  const cfg = state.config;
  if (el.dataset.cfg)
    cfg[el.dataset.cfg] = el.value.trim() === '' ? DEF_CFG[el.dataset.cfg] : num(el.value); // empty: the default
  else if (el.name === 'cfg_inKind') cfg.inKind = el.value === '1';
  else return;
  saveConfig();
  fillSettings(state.config, el);
  paintAll();
}

/* --- Buttons --- */

/** What the sheep says when tapped (never the same twice in a row). */
const BLEATS = [
  '¡Beee!',
  '¡Meee!',
  '¡Mééé!',
  'Bee… paga la pernocta',
  '¡Contrato o nada!',
  'Beee… ¿y las horas extra?',
  'La lana, en nómina',
  'Bee-bé el negro, no cotiza',
  '¡Descanso semanal, beee!',
  'Esquílame, pero con alta',
  'Yo también duermo en la borda',
  'Meee… ¿vacaciones?',
  '¡Sindicato, beee!',
  'Ni un día sin contrato',
  'Bee… día y medio de descanso semanal',
  'Contigo hasta la majada',
  'Más hierba y menos horas',
  'Mi pastor no se regala',
  '¡Que coticen hasta las ovejas!',
  'Beee… ¿esto lo sabe la Inspección?',
];

/** The «⋯» menu of the ficha and the cards. */
let offerMenu;

const offerById = (id) => state.offers.find((o) => o.id === id);

function duplicate(o) {
  const copy = {
    ...structuredClone(o),
    id: newId(),
    cmp: true,
  };
  copy.mine.name = `${o.mine.name} (copia)`;
  offers.add(copy, { after: o });
  select(copy.id);
}

function remove(o) {
  const backToWelcome = offers.remove(o);
  // Not both: going back through history and then pushing the entry would race
  if (!backToWelcome) leaveFicha();
  show();
  if (backToWelcome) startEntry(true);
}

/** What the menu does with an offer; true if it copied. */
function runMenuAction(action, id, msg) {
  const o = offerById(id);
  if (action === 'duplicate') return duplicate(o);
  if (action === 'delete') return remove(o);
  if (action === 'copyCard')
    return copyText(cardText(o, calcOffer(o)), msg, {
      ok: 'Ficha copiada.',
      failMsg: 'No se pudo copiar. Aquí está para seleccionarla:',
      rows: 7,
    });
  return copyText(claimText(o, calcOffer(o)), msg, {
    ok: 'Texto copiado.',
    failMsg: 'No se pudo copiar. Aquí está para seleccionarlo:',
    rows: 12,
  });
}

/** Copying needs the whole result, and the claim something to claim. */
function menuAvailability(id) {
  const o = offerById(id);
  const copy = missing(o.terms).length === 0;
  return { copy, claim: copy && !!legalLine(o, calcOffer(o)) };
}

/** Everything done with a button: the button says what with data-action, and data-id if it is about an offer. */
const ACTIONS = {
  tab(b) {
    if (fichaOpen()) closeFicha();
    showTab(b.dataset.tab, true);
  },
  openAccountPage: () => openAccountPage(),
  openSettingsPage: () => openSettingsPage(),
  openAccountFromPrompt: () => openAccountPage(true),
  closePage,
  changePlace,

  /* Comparar */
  // Tapping an offer picks it for the head to head; with a third, the first one picked drops out
  pickPair(b) {
    const id = b.dataset.id;
    const { pairing } = state;
    pairing.ids = pairing.ids.includes(id) ? pairing.ids.filter((x) => x !== id) : [...pairing.ids, id].slice(-2);
    paintAll();
    if (state.pairing.ids.length === 2) scrollToElement($('#pairBlk'), 'center');
  },
  startPair() {
    state.pairing.on = true;
    state.pairing.ids = [];
    paintAll();
  },
  closePair() {
    state.pairing.on = false;
    state.pairing.ids = [];
    paintAll();
  },
  viewShared: (b) => viewShared(b.dataset.id),
  closeShared: () => viewShared(null),
  refreshOthers: () => loadOthers(),
  view: (b) => openOffer(b.dataset.id),

  beee(b) {
    const bubble = $('.beee', b);
    const others = BLEATS.filter((t) => t !== bubble.textContent);
    bubble.textContent = others[Math.floor(Math.random() * others.length)];
    b.classList.remove('bleating');
    void b.offsetWidth; // restart the animation
    b.classList.add('bleating');
    clearTimeout(b._timer);
    b._timer = setTimeout(() => b.classList.remove('bleating'), 1600);
  },

  /* Offers */
  openOffer: (b) => openOffer(b.dataset.id),
  closeFicha,
  newOffer: () => startEntry(),
  template: (b) => pickTemplate(b.dataset.template),
  editStep: (b) => editStep(b.dataset.step, b.classList.contains('missing')),
  complete: () => editStep(stepOfMissing(active().terms), true),
  entryNext: next,
  entryBack: back,
  entryClose: close,
  /** Without an end date the duration is not known. */
  clearEnd() {
    active().terms.durationUnit = 'unknown';
    /** @type {HTMLInputElement} */ ($('#f [name=durationUnit][value=unknown]')).checked = true;
    paintEnd(active().terms);
    animateNextPaint();
    commit();
  },
  clearStart() {
    active().terms.start = '';
    /** @type {HTMLInputElement} */ ($('#start')).value = '';
    paintEnd(active().terms);
    animateNextPaint();
    commit();
  },
  offerMenu: (b) => offerMenu.open(b, b.dataset.id),

  /* The result */
  payslipMonth(b) {
    stepPayslipMonth(b.dataset.offer, Number(b.dataset.step));
    paintAll();
  },

  /* Account */
  ...accountActions,

  /* Backups */
  download: (b) => downloadBackup(b.closest('#backupNotice') ? $('#noticeMsg') : $('#backupSaveResult')),
  snoozeBackup() {
    snoozeReminder();
    paintBackup();
  },
  copyBackupText: () => copyBackup($('#backupSaveResult')),
  loadBackupText() {
    const box = /** @type {HTMLTextAreaElement} */ ($('#backupPaste'));
    if (!box.value.trim()) {
      $('#backupResult').textContent = 'Pega antes el texto de una copia.';
      $('#backupResult').dataset.kind = 'warn';
      box.focus();
      return;
    }
    if (loadBackup(box.value, $('#backupResult'))) box.value = '';
  },
};

/** Collapsibles open and close animating their height. */
function onSummaryClick(e) {
  const summary = /** @type {Element} */ (e.target).closest('summary');
  const details = summary?.parentElement;
  if (!(details instanceof HTMLDetailsElement) || summary !== details.querySelector(':scope > summary')) return;
  // In Ajustes the sections are always open: their title does not fold
  if (details.classList.contains('fixed')) {
    e.preventDefault();
    return;
  }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  e.preventDefault();
  toggleFold(details, !details.open);
}

/** The backup file, picked or dropped anywhere in the section (a file dropped on the text box would be opened by the browser). */
function setUpBackupFile() {
  const section = $('#backup');
  const drop = $('#backupDrop');
  const hasFile = (e) => [...e.dataTransfer.types].includes('Files');
  section.addEventListener('dragover', (e) => {
    if (!hasFile(e)) return;
    e.preventDefault();
    drop.classList.add('dragging');
  });
  section.addEventListener('dragleave', (e) => {
    if (!section.contains(/** @type {Node} */ (e.relatedTarget))) drop.classList.remove('dragging');
  });
  section.addEventListener('drop', async (e) => {
    const file = e.dataTransfer.files?.[0];
    drop.classList.remove('dragging');
    if (!file) return;
    e.preventDefault();
    loadBackup(await file.text(), $('#backupResult'));
  });
  $('#backupFile').addEventListener('change', async (e) => {
    const input = /** @type {HTMLInputElement} */ (e.target);
    const file = input.files?.[0];
    if (!file) return;
    loadBackup(await file.text(), $('#backupResult'));
    input.value = '';
  });
}

export function setUpEvents() {
  offerMenu = setUpOfferMenu({ available: menuAvailability, run: runMenuAction });
  form().addEventListener('input', onFormInput);
  form().addEventListener('focusout', onFormFocusOut);
  $('#yourdata').addEventListener('input', onSettingsInput);
  $('#assumptions').addEventListener('input', onSettingsInput);
  addEventListener('popstate', onPopState);
  document.addEventListener('click', onSummaryClick);
  document.addEventListener('click', (e) => {
    const button = /** @type {HTMLElement | null} */ (/** @type {Element} */ (e.target).closest('[data-action]'));
    if (button) ACTIONS[button.dataset.action](button);
  });
  document.addEventListener('change', (e) => {
    const el = /** @type {HTMLInputElement} */ (e.target);
    if (el.name === 'showOfferOnly') {
      state.showOfferOnly = el.checked;
      paintAll();
    }
    if (el.name === 'sortBy') {
      state.moneyOnly = el.value === 'money';
      paintAll();
    }
    if (el.name === 'termsOnly') {
      state.termsOnly = el.checked;
      paintAll();
    }
    if (el.name === 'includeOthers') {
      state.others.include = el.checked;
      paintAll();
      if (el.checked) loadOthers();
    }
    if (el.id === 'profSharing') onSharingToggled(el.checked);
    if (el.name !== 'cmpUnit') return;
    state.cmpUnit = el.value;
    saveCmpUnit();
    paintAll();
  });
  // A collapsible opened without animation (keyboard, reduced motion) is remembered too
  document.addEventListener(
    'toggle',
    (e) => {
      const d = /** @type {HTMLDetailsElement & {_animating?: boolean}} */ (e.target);
      if (d.dataset?.fold && !d._animating) saveFold(d);
    },
    true,
  );
  setUpBackupFile();
}
