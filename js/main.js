'use strict';
/* Startup. */

offers.forEach(defaultVacation); showTab((t=>LEGACY.tabs[t]??t)(store.get(KEY.tab,'offers'))); renderChips.scroll=true; fill(active); fillCfg(); renderAll();
if(firstRun) openTpl();
