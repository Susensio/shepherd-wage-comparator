/** Events: the offer form, «Tus datos», collapsibles, and every button, by its data-action. */

import {
  animateNextPaint,
  chipEdges,
  closeTemplates,
  commit,
  done,
  fillVacation,
  openFirstSections,
  openTemplates,
  paintAll,
  scrollChipsNextPaint,
  select,
  templatesOpen,
  viewShared,
} from './app.js';
import { fInputValue, num } from './format.js';
import {
  DAYS_PER_MONTH,
  DEF_CFG,
  defaultVacation,
  HERD,
  isoOf,
  makeOffer,
  newId,
  parseDate,
  sideOf,
  TEMPLATES,
} from './offer.js';
import { active, calcOffer, KEY, saveCmpUnit, saveConfig, state, store } from './state.js';
import { copyBackup, downloadBackup, loadBackup } from './storage/backup.js';
import { snoozeReminder } from './storage/bundle.js';
import { preloadPlaces } from './storage/places.js';
import { cardText, claimText } from './text.js';
import { accountActions, onSharingToggled } from './ui/account-section.js';
import { $, copyText, doubleTap } from './ui/dom.js';
import { saveFold } from './ui/folds.js';
import { openEditor, scrollToElement, setNavHeight, syncEditor, toggleFold } from './ui/motion.js';
import { closePage, onPopState, openAccountPage, openSettingsPage, showTab } from './ui/navigation.js';
import { loadOthers } from './ui/others.js';
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

function onFormInput(e) {
  const el = /** @type {HTMLInputElement} */ (e.target);
  const o = active();
  const { terms } = o;
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
  } else if (el.type === 'radio') {
    if (el.checked) side[el.name] = el.value;
  } else if (el.type === 'checkbox') side[el.name] = el.checked;
  else if (el.type === 'date') side[el.name] = el.value;
  else if (el.name === 'name') side.name = el.value;
  else if (el.name === 'rentValue' && el.value.trim() === '')
    side.rentValue = ''; // empty: the one in «Tus datos»
  else if (HERD.some(([field]) => field === el.name) && el.value.trim() === '')
    side[el.name] = ''; // no head count
  else side[el.name] = num(el.value);
  animateNextPaint();
  if (el.name === 'vacation') delete terms.vacationAuto;
  if (el.name === 'cashMode' && el.value === 'total') {
    if (!(num(terms.totalAmount) > 0))
      terms.totalUnit = ['day', 'month'].includes(terms.payUnit) ? terms.payUnit : 'month';
    fillForm(o);
  }
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

/* --- «Tus datos» and the assumptions: they apply to every offer --- */

function onSettingsInput(e) {
  const el = /** @type {HTMLInputElement} */ (e.target);
  const cfg = state.config;
  if (el.dataset.cfg)
    cfg[el.dataset.cfg] = el.value.trim() === '' ? DEF_CFG[el.dataset.cfg] : num(el.value); // empty: the default
  else if (el.name === 'cfg_inKind') cfg.inKind = el.value === '1';
  else if (el.name === 'cfg_unemployment') cfg.unemployment = el.value === '1';
  else return;
  saveConfig();
  fillSettings(state.config, el);
  paintAll();
}

/* --- Buttons --- */

/** A new offer's name, not repeating one you have. */
function uniqueName(base) {
  let name = base;
  for (let i = 2; state.offers.some((o) => o.mine.name === name); i++) name = `${base} ${i}`;
  return name;
}

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

let deleteButton;

/** Everything done with a button: the button says what with data-action, and data-id if it is about an offer. */
const ACTIONS = {
  tab: (b) => showTab(b.dataset.tab, true),
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
  view(b) {
    // to see the offer, without opening the form
    showTab('offers');
    scrollChipsNextPaint();
    select(b.dataset.id);
    scrollToElement($('#results'));
  },

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
  newOffer: () => (templatesOpen() ? closeTemplates() : openTemplates()),
  choose(b) {
    if (templatesOpen()) closeTemplates();
    if (b.dataset.id === state.activeId) return;
    deleteButton.reset();
    scrollChipsNextPaint();
    select(b.dataset.id);
  },
  template(b) {
    const template = TEMPLATES.find((t) => t.id === b.dataset.template);
    const o = makeOffer(template?.terms, { ...template?.mine, name: uniqueName(template?.title || 'Oferta') });
    if (state.placeholderId && state.offers.length === 1 && state.offers[0].id === state.placeholderId)
      state.offers = [];
    state.placeholderId = null;
    state.offers.push(o);
    closeTemplates();
    scrollChipsNextPaint();
    select(o.id);
    openEditor(true);
    openFirstSections();
    const name = /** @type {HTMLInputElement} */ ($('#name'));
    scrollToElement(name, 'center');
    name.focus({ preventScroll: true });
    name.select();
  },
  duplicate() {
    const o = active();
    const copy = {
      ...structuredClone(o),
      id: newId(),
      cmp: true,
    };
    copy.mine.name = `${o.mine.name} (copia)`;
    state.offers.splice(state.offers.indexOf(o) + 1, 0, copy);
    select(copy.id);
  },
  deleteOffer() {
    const o = active();
    if (!deleteButton.confirm(`¿Borrar «${o.mine.name}»? Toca otra vez`)) return;
    const i = state.offers.indexOf(o);
    state.offers.splice(i, 1);
    if (!state.offers.length) {
      // no offers left: back to the welcome
      const blank = makeOffer();
      state.offers.push(blank);
      state.placeholderId = blank.id;
      select(blank.id);
      store.set(KEY.offers, null);
      openTemplates();
      return;
    }
    select(state.offers[Math.max(0, i - 1)].id);
  },
  edit: () => toggleFold(/** @type {HTMLDetailsElement} */ ($('#editWrap')), true),
  complete() {
    if (!(/** @type {HTMLDetailsElement} */ ($('#editWrap')).open)) openEditor(true);
    done(false);
  },
  done: () => done(false), // «Hecho» at the bottom; the one at the top is the form's own title

  /* The result */
  copyCard: () =>
    copyText(cardText(active(), calcOffer(active())), $('#cardMsg'), {
      ok: 'Ficha copiada.',
      failMsg: 'No se pudo copiar. Aquí la tienes para seleccionarla:',
      rows: 7,
    }),
  copyClaim: () =>
    copyText(claimText(active(), calcOffer(active())), $('#claimMsg'), {
      ok: 'Texto copiado.',
      failMsg: 'No se pudo copiar. Aquí lo tienes para seleccionarlo:',
      rows: 12,
    }),
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
  // «Hecho» at the top does the same as the one at the bottom
  if (details.id === 'editWrap' && details.open) {
    e.preventDefault();
    done(true);
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
  deleteButton = doubleTap($('#btnDel'), 'Borrar', 4000);
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
  $('#editWrap').addEventListener('toggle', () => {
    if (/** @type {HTMLDetailsElement} */ ($('#editWrap')).open) preloadPlaces();
    if (!(/** @type {any} */ ($('#editWrap'))._animating)) syncEditor();
  });
  $('#chips').addEventListener('scroll', chipEdges, { passive: true });
  addEventListener('resize', () => {
    setNavHeight();
    chipEdges();
  });
  setUpBackupFile();
}
