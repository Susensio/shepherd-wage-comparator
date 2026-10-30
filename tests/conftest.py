"""Shared fixtures: a headless Chromium page with the app loaded from disk, and the sample offers."""

import json
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
INDEX = (ROOT / "index.html").as_uri()
FIXTURES = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch()
        yield b
        b.close()


@pytest.fixture
def context(browser):
    ctx = browser.new_context(viewport={"width": 390, "height": 900})
    # No network: the page must work without its web fonts.
    ctx.route("**/*", lambda route: route.abort() if not route.request.url.startswith("file:") else route.continue_())
    yield ctx
    ctx.close()


@pytest.fixture
def errors():
    return []


@pytest.fixture
def open_page(context, errors):
    """Opens the app in a new tab, collecting page errors. Pass init_script to run code before the app starts."""

    def _open(init_script=None, ctx=None):
        page = (ctx or context).new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        if init_script:
            page.add_init_script(init_script)
        page.goto(INDEX)
        page.wait_for_timeout(200)
        return page

    return _open


@pytest.fixture
def page(open_page):
    return open_page()


@pytest.fixture(scope="session")
def sample():
    """Eight offers covering the main cases (seasonal, casual, no contract, cash, overnight…), in today's format."""
    return json.loads((FIXTURES / "offers.json").read_text())


@pytest.fixture(scope="session")
def sample_es():
    """The same offers as saved by the Spanish-era versions of the page (before October 2026)."""
    return json.loads((FIXTURES / "offers_es.json").read_text())


@pytest.fixture
def loaded(page, sample):
    """The app with the sample offers loaded."""
    page.evaluate(
        "d=>{closeTpl(); offers=d.offers.map(norm); config={...DEF_CFG,...d.cfg}; saveCfg(); select(offers[1].id)}",
        sample,
    )
    return page
