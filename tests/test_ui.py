"""The main flows, clicked through as a person would."""

import json


def fill_offer(page, duration="4", hours="11", pay="70"):
    page.fill("#duration", duration)
    page.fill("#hoursPerDay", hours)
    page.check("input[name=vacation][value=included]")
    page.fill("#payAmount", pay)


def test_new_offer_from_template(page, errors):
    page.click(".tcard >> nth=0")
    fill_offer(page)
    assert "€" in page.inner_text("#result .big")
    page.check("input[name=durationUnit][value=days]")
    assert page.input_value("#duration") == "122"
    assert not errors


def test_end_date_sets_the_duration(page, errors):
    page.click(".tcard >> nth=0")
    page.fill("#start", "2026-06-21")
    page.fill("#end", "2026-09-30")
    assert page.input_value("#duration") == "102"
    assert page.is_checked("input[name=durationUnit][value=days]")
    assert not errors


def test_duplicate_and_delete(page, errors):
    page.click(".tcard >> nth=0")
    fill_offer(page)
    page.click("[data-action=duplicate]")
    names = page.evaluate("app.state.offers.map(o=>o.name)")
    assert len(names) == 2 and names[1].endswith("(copia)")
    page.click("#btnDel")
    assert "Toca otra vez" in page.inner_text("#btnDel")
    page.click("#btnDel")
    assert page.evaluate("app.state.offers.length") == 1
    assert not errors


def test_compare_and_view(page, errors):
    page.click(".tcard >> nth=0")
    fill_offer(page)
    page.click("#btnAdd")
    page.click(".tcard >> nth=2")
    fill_offer(page, duration="15", hours="10", pay="80")
    page.click("#btnGoRes")
    page.click(".tabs [data-tab=compare]")
    assert page.locator("#cmpBlk .lr").count() == 2
    assert page.inner_text("#cmpBlk .lr .v").endswith("/hora")
    page.click("#cmpView label:has-text('total')")
    assert page.evaluate("app.state.cmpUnit") == "total" and "/hora" not in page.inner_text("#cmpBlk .lr .v")
    page.click("#cmpBlk [data-action=view] >> nth=1")
    assert page.eval_on_selector(".tabs [aria-selected=true]", "e=>e.dataset.tab") == "offers"
    assert not errors


def test_head_to_head(loaded, errors):
    loaded.click(".tabs [data-tab=compare]")
    loaded.click("[data-action=startPair]")
    loaded.click(".lr >> nth=0")
    loaded.click(".lr >> nth=2")
    assert "Cara a cara" in loaded.inner_text("#pairBlk")
    loaded.click("#pairBlk [data-action=closePair]")
    assert loaded.locator("#pairBlk").count() == 0
    assert not errors


def test_settings_apply_to_every_offer(page, errors):
    page.click(".tcard >> nth=0")
    page.click(".tabs [data-tab=settings]")
    page.fill("#cfg_overnight", "30")
    assert page.evaluate("app.state.config.overnightPct") == 30
    assert not errors


def test_done_with_missing_data(page, errors):
    page.click(".tcard:has-text('Temporada')")
    page.wait_for_timeout(300)
    page.evaluate("scrollTo(0,0)")
    page.click("#editBtn")
    page.wait_for_timeout(400)
    assert page.evaluate("document.querySelector('#editWrap').open")
    assert page.text_content("#goMsg").startswith("Falta")
    assert page.locator(".fld.missing").count() > 0
    assert page.evaluate("document.querySelector('.chip[aria-current=true]').classList.contains('incomplete')")
    assert not errors


def test_copy_claim(loaded, errors):
    loaded.click(".tabs [data-tab=offers]")
    loaded.click("[data-action=copyClaim]")
    loaded.wait_for_timeout(100)
    assert loaded.inner_text("#claimMsg")
    text = loaded.evaluate("app.claimText(app.active(),app.calcOffer(app.active()))")
    assert "SALARIO" in text and "Comparador de jornales" in text
    assert not errors


DOWNLOADS_STUB = """window.__saved=[];window.claude={use:n=>Promise.resolve(n==='downloads'?{save:async r=>{window.__saved.push(r);return {status:'saved'}}}:null)};"""


def test_backup_round_trip(new_context, open_page, errors, tmp_path):
    ctx = new_context()
    page = open_page(DOWNLOADS_STUB, ctx=ctx)
    page.click(".tcard >> nth=0")
    fill_offer(page, hours="10", pay="60")
    assert page.is_visible("#backupNotice")
    page.click("#backupNotice [data-action=download]")
    page.wait_for_timeout(200)
    saved = page.evaluate("window.__saved")
    assert saved and saved[0]["filename"].endswith(".json")
    backup = tmp_path / "backup.json"
    backup.write_text(saved[0]["data"])
    assert "offers" in json.loads(saved[0]["data"])

    clean = new_context()
    other = open_page(ctx=clean)
    other.set_input_files("#backupFile", str(backup))
    other.wait_for_timeout(300)
    assert other.inner_text("#bkMsg2").startswith("Añadida 1 oferta")
    other.set_input_files("#backupFile", str(backup))
    other.wait_for_timeout(300)
    assert "ya la tenías" in other.inner_text("#bkMsg2")
    assert not errors
