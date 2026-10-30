"""The legal data in js/law.js is complete and is what the page shows."""

import datetime


def test_min_wage_covers_this_year(page):
    """Fails in January if nobody has added the new year's minimum wage yet."""
    years = page.evaluate("Object.keys(MIN_WAGE).map(Number)")
    assert years == list(range(years[0], years[-1] + 1)), "years must be consecutive"
    assert datetime.date.today().year in years, "add this year's minimum wage to js/law.js"


def test_min_wage_figures_are_plausible(page):
    problems = page.evaluate("""Object.entries(MIN_WAGE).flatMap(([y,m])=>[
        !(m.casual>m.annual/LAW.smiDaysPerYear)&&`${y}: casual daily minimum below the daily share of the annual`,
        !(m.decree&&m.url)&&`${y}: decree or link missing`,
        m.ded&&!(m.ded.max>0&&m.ded.taper>0&&m.ded.from>=m.annual-1)&&`${y}: odd IRPF deduction`].filter(Boolean))""")
    assert not problems, problems


def test_every_rule_has_a_source_or_a_note(page):
    problems = page.evaluate("""Object.entries(RULES).filter(([k,r])=>!(r.source?SOURCES[r.source]&&r.art:r.note)).map(([k])=>k)""")
    assert not problems, problems


def test_defaults_come_from_the_law(page):
    assert page.evaluate("DEF_CFG.ssPct===ssTotal(SOCIAL_SECURITY.worker)")
    assert page.evaluate("DEF_CFG.ssEmp===ssTotal(SOCIAL_SECURITY.employer)")
    assert page.evaluate("DEF_CFG.overnightPct===LAW.overnightPct && DEF_CFG.vacationDaysPerYear===LAW.vacationDaysPerYear")


def test_laws_tab_is_filled_in(page):
    empty = page.evaluate("[...document.querySelectorAll('[data-law]')].filter(e=>!e.textContent.trim()).map(e=>e.dataset.law)")
    assert not empty, empty
    unlinked = page.evaluate("[...document.querySelectorAll('a[data-source]')].filter(a=>!a.href.startsWith('https://')).length")
    assert unlinked == 0
    page.evaluate("closeTpl(); showTab('laws')")
    text = page.inner_text("[data-panel=laws]")
    year = page.evaluate("Object.keys(MIN_WAGE).at(-1)")
    assert f"en {year}," in text
