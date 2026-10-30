"""Shared fixtures: the page served over http, a headless Chromium page with the app loaded, and the sample offers."""

import functools
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = Path(__file__).resolve().parent / "fixtures"

# Loads the sample offers and settings into the app, and shows the second offer.
LOAD_SAMPLE = """async d=>{
  const {normalizeOffer}=await import('./src/legacy.js'), {DEF_CFG}=await import('./src/offer.js'), {saveConfig}=await import('./src/state.js');
  app.closeTemplates(); app.state.offers=d.offers.map(normalizeOffer); app.state.config={...DEF_CFG,...d.cfg}; saveConfig();
  app.select(app.state.offers[d.show ?? 1].id)}"""


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


@pytest.fixture(scope="session")
def site():
    """The page, served from the repository: ES modules do not load from file://."""
    server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_address[1]}/"
    server.shutdown()


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch()
        yield b
        b.close()


def offline(ctx, site):
    """No network but the page itself: it must work without its web fonts."""
    ctx.route("**/*", lambda route: route.continue_() if route.request.url.startswith(site) else route.abort())
    return ctx


@pytest.fixture
def new_context(browser, site):
    """A fresh browser profile (its own storage), offline."""
    made = []

    def _new(**options):
        made.append(offline(browser.new_context(viewport={"width": 390, "height": 900}, **options), site))
        return made[-1]

    yield _new
    for ctx in made:
        ctx.close()


@pytest.fixture
def context(new_context):
    return new_context()


@pytest.fixture
def errors():
    return []


@pytest.fixture
def open_page(context, errors, site):
    """Opens the app in a new tab, collecting page errors. Pass init_script to run code before the app starts."""

    def _open(init_script=None, ctx=None):
        page = (ctx or context).new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        if init_script:
            page.add_init_script(init_script)
        page.goto(site)
        page.wait_for_function("window.app")
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
    page.evaluate(LOAD_SAMPLE, sample)
    return page
