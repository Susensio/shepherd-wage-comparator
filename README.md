# Shepherd Wage Comparator

A page for shepherds in Spain to compare job offers. It checks each offer against the legal minimum wage, the night-stay bonus, holidays, weekly rest and the 40-hour week, and shows what is left unpaid, both on the payslip and in cash.

Live at **https://susensio.github.io/shepherd-wage-comparator/**. The interface is in Spanish.

## How it works

Plain HTML, CSS and JavaScript, with no dependencies or build step: open `index.html` in a browser, or serve the folder as it is. Offers are saved in the browser (`localStorage`). When the page runs as a Claude artifact, it also syncs to the user's Claude account.

```
index.html        markup; loads the stylesheet and the scripts in order
css/styles.css
js/               one file per part: constants, model, rendering, events…
tests/            pytest + Playwright
```

## Tests

```
uv sync
uv run playwright install chromium
uv run pytest
```

The tests cover the calculations, that every figure on the page adds up, the main flows and loading data saved by older versions.

The figures are estimates and are not legal advice.
