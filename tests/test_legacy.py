"""Data saved by the Spanish-era versions (before October 2026) still loads, from every place it can come from."""

import json


def spanish_storage(sample_es):
    first = sample_es["ofertas"][1]["id"]
    return f"""
localStorage.setItem('cj.ofertas',{json.dumps(json.dumps(sample_es['ofertas']))});
localStorage.setItem('cj.cfg',{json.dumps(json.dumps(sample_es['cfg']))});
localStorage.setItem('cj.active',{json.dumps(json.dumps(first))});
localStorage.setItem('cj.unidadCmp','"mes"');
localStorage.setItem('cj.tab','"comparar"');
localStorage.setItem('cj.secs',JSON.stringify({{tiempo:false,cuentas:true,roja:true}}));
localStorage.setItem('cj.copia',JSON.stringify({{fecha:Date.now(),firma:'x'}}));"""


def test_browser_storage(open_page, sample, sample_es, errors):
    page = open_page(spanish_storage(sample_es))
    state = page.evaluate("""({tab:document.querySelector('.tabs [aria-selected=true]').dataset.tab, unit:cmpUnit,
        offers:offers.map(o=>({id:o.id,name:o.name,contract:o.contract,vacation:o.vacation,duration:o.duration})),
        cfg:config.fuelUse, folds:{time:folds.time,workings:folds.workings,owed:folds.owed}, backup:$('#backupStatus').textContent})""")
    assert state["tab"] == "compare"
    assert state["unit"] == "month"
    expected = [{k: o.get(k) for k in ("id", "name", "contract", "vacation", "duration")} for o in sample["offers"]]
    assert state["offers"] == expected
    assert state["cfg"] == sample_es["cfg"]["consumo"]
    assert state["folds"] == {"time": False, "workings": True, "owed": True}
    assert state["backup"].startswith("Última copia: hoy")
    assert not errors


def test_same_figures_as_english_data(open_page, sample, sample_es, errors):
    """Spanish-era data gives exactly the same result as the same offers in today's format."""
    old = open_page(spanish_storage(sample_es))
    old.click(".tabs [data-tab=offers]")
    new = open_page()
    new.evaluate("d=>{closeTpl(); offers=d.offers.map(norm); config={...DEF_CFG,...d.cfg}; saveCfg(); select(offers[0].id)}", sample)
    for offer in sample["offers"]:
        for p in (old, new):
            p.evaluate(f"select('{offer['id']}')")
            p.evaluate("document.querySelectorAll('#result details').forEach(d=>d.open=true)")
        assert old.inner_text("#result") == new.inner_text("#result"), offer["name"]
    assert not errors


def test_backup_file(page, sample_es, errors):
    result = page.evaluate(
        "t=>{const m=document.createElement('p'); const ok=loadBackup(t,m); return [ok,m.textContent,offers.map(o=>o.contract)]}",
        json.dumps(sample_es),
    )
    assert result[0] is True
    assert result[1] == "Añadidas 8 ofertas."
    assert set(result[2]) <= {"temporary", "seasonal", "permanent", "none"}
    assert not errors


def test_cloud_document(open_page, sample_es, errors):
    """A Spanish-era document in the Claude account is read, and saved back in today's format."""
    stub = f"""const DOC={json.dumps({**sample_es, 'ts': 9e12})}; window.__set=null;
window.claude={{use:n=>Promise.resolve(n==='user'?{{id:async()=>'u1'}}:n==='db'?{{doc:()=>({{get:async()=>({{exists:true,data:()=>DOC}}),set:async d=>{{window.__set=d}}}})}}:null)}};"""
    page = open_page(stub)
    page.wait_for_timeout(300)
    assert page.evaluate("offers.length") == 8
    assert page.evaluate("inCloud")
    page.evaluate("active.name='Cambiada'; persist()")
    page.wait_for_timeout(1800)
    saved = page.evaluate("window.__set")
    assert saved and "offers" in saved and "ofertas" not in saved
    assert "name" in saved["offers"][0] and "nombre" not in saved["offers"][0]
    assert not errors
