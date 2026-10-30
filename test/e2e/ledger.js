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
    let sum = null;
    const title = (rows.closest('section,details')?.querySelector('h4,summary,.lev-t')?.textContent || '')
      .trim()
      .slice(0, 40);
    for (const row of rows.querySelectorAll(':scope > .row')) {
      if (row.classList.contains('hd')) continue;
      const figure = row.lastElementChild;
      const op = figure.querySelector('.op')?.textContent;
      const number = figure.querySelector('.nm') || figure;
      const value = parse((number.querySelector('.two > span') || number).textContent);
      const label = row.firstElementChild.firstChild?.textContent?.trim();
      if (value == null) continue;
      if (!op) sum = value;
      else if (op === '+') sum += value;
      else if (op === '−') sum -= value;
      else if (op === '×') sum *= value;
      else if (op === '=') {
        const tolerance = Math.max(1.01, Math.abs(value) * 0.006);
        if (sum != null && Math.abs(sum - value) > tolerance && !(value === 0 && sum < 0))
          problems.push(`[${title}] «${label}» = ${value}, but the rows give ${Math.round(sum * 100) / 100}`);
        sum = value;
      }
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
