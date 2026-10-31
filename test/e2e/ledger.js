// Runs in the page (it is passed to `page.evaluate` as it is): nothing outside its body may be used.

/** Every ledger with signs under `root`: the figure after «=» must come out of the rows above it. Bars must not overflow. */
export function ledgerProblems(root) {
  const problems = [];
  const parse = (text) => {
    if (text == null) return null;
    const t = text.replace(/ /g, ' ').trim();
    if (t === 'nada') return 0;
    const m = t.match(/-?[\d.]+(,\d+)?/);
    return m ? Number.parseFloat(m[0].replace(/\./g, '').replace(',', '.')) : null;
  };
  for (const rows of document.querySelectorAll(`${root} .rows`)) {
    // One running sum per column: a row with two figures (day, month) adds up in each
    const sums = [];
    const title = (rows.closest('section,details')?.querySelector('h4,summary,.lev-t')?.textContent || '')
      .trim()
      .slice(0, 40);
    for (const row of rows.querySelectorAll(':scope > .row')) {
      if (row.classList.contains('hd')) continue;
      const figure = row.lastElementChild;
      // The breakdown has no signs: its rows are added (those starting with «−» taken off) up to «Cobras» and «Ganas»
      const op =
        figure.querySelector('.op')?.textContent ||
        (rows.closest('[data-fold="breakdown2"]')
          ? /\b(subt|tot)\b/.test(row.className)
            ? '='
            : figure.textContent.trim().startsWith('−')
              ? '−'
              : sums.length
                ? '+'
                : undefined
          : undefined);
      const number = figure.querySelector('.nm') || figure;
      const cells = number.querySelectorAll('.two > span');
      const values = (cells.length ? [...cells] : [number]).map((cell) => parse(cell.textContent));
      const label = row.children[row.children.length - 2].textContent.trim();
      values.forEach((value, i) => {
        if (value == null) return;
        if (!op) sums[i] = value;
        else if (op === '+') sums[i] += value;
        else if (op === '−') sums[i] -= value;
        else if (op === '×') sums[i] *= value;
        else if (op === '=') {
          if (sums[i] != null && Math.abs(sums[i] - value) > 0.001 && !(value === 0 && sums[i] < 0))
            problems.push(
              `[${title}] «${label}» = ${value}, but the rows give ${Math.round(sums[i] * 100) / 100} (column ${i + 1})`,
            );
          sums[i] = value;
        }
      });
    }
  }
  for (const bar of document.querySelectorAll(`${root} .br`)) {
    const width = [...bar.querySelectorAll('.br-b i')].reduce(
      (total, i) => total + Number.parseFloat(i.style.width),
      0,
    );
    if (width > 100.6)
      problems.push(
        `bar «${bar.querySelector('.br-l')?.textContent?.trim()?.slice(0, 40)}»: segments take ${width.toFixed(1)} %`,
      );
  }
  return problems;
}
