"""The legal figures the page shows come from src/law.js. The data itself is checked in test/law.test.js."""


def test_laws_tab_is_filled_in(page, errors):
    empty = page.evaluate("[...document.querySelectorAll('[data-law]')].filter(e=>!e.textContent.trim()).map(e=>e.dataset.law)")
    assert not empty, empty
    unlinked = page.evaluate("[...document.querySelectorAll('a[data-source]')].filter(a=>!a.href.startsWith('https://')).length")
    assert unlinked == 0
    page.evaluate("app.closeTemplates(); app.showTab('laws')")
    text = page.inner_text("[data-panel=laws]")
    year = page.evaluate("async()=>Object.keys((await import('./src/law.js')).MIN_WAGE).at(-1)")
    assert f"en {year}," in text
    assert not errors
