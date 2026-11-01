# Backlog

- modes | Split the app into stages of the process instead of one analysis view. Today the analysis comes first and the other tabs help with later stages.
  Not designed yet. Stages to explore: analysis (current), negotiation, signing.
- modes | Negotiation mode: build on `views/negotiate.js` to lead a conversation with the employer.
- modes | Signing mode: generate a PDF of the agreed conditions, asking for whatever is still missing so nothing is left undefined and there are no surprises afterwards.
  Open: which fields a contract must fix (wage, hours, night stays, rest, holidays, accommodation, who pays what), PDF generation without a build step.
- ai | A small AI agent that helps through the whole process (understand an offer, negotiate, fill the missing conditions).
  Open: where the model runs and who pays for it, what personal data may leave the browser, how to keep answers tied to `law.js` instead of invented figures.
- paint | Every repaint recomputes `calc` for all offers, each with nested `alone` calcs for the IRPF of the others, and `paintAll` computes the active offer twice.
  Measured 2.8 ms for the 8 sample offers in Node (October 2026), so not a problem now.
  Revisit if the number of offers grows, for example once accounts bring many.
- account | Sign-in by emailed code is built but off (`emailSignIn` in `storage/account-config.js`, ADR-0009). To turn it on: a custom SMTP sender in Supabase (Resend's free plan, 100 emails a day, is enough; store its API key as an environment secret so a session can configure it), then the «Magic link» and «Confirm signup» templates in Spanish with `{{ .Token }}` (the code is already 6 digits), then `emailSignIn: true` and a real sign-in. Supabase's built-in sender reaches only the project's team, two emails an hour, and its templates cannot be changed on the free plan.
- account | Google refused `http://localhost:8000` as an origin on 31 October 2026, though `https://susensio.github.io` worked: check the OAuth client's Authorized JavaScript origins before testing sign-in on a computer.
- ops | One-time steps to turn on `.github/workflows/db.yml` (migrations are applied by the action; until then it skips itself): (1) in GitHub, Settings, Secrets and variables, Actions, add `SUPABASE_ACCESS_TOKEN` (a personal access token, supabase.com/dashboard/account/tokens; Project Settings, API Keys and API Key Secrets with Read), `SUPABASE_DB_PASSWORD` (the project's database password) and `SUPABASE_PROJECT_ID` (`etvrgexvjviavulflcqr`); (2) once, from a machine with the CLI, mark the baseline as applied so the push does not re-run it: `supabase link --project-ref etvrgexvjviavulflcqr`, then `supabase migration repair --status applied 20261031000000`, then `supabase migration list` should show it on both sides (if `link` or `db push` asks for `supabase/config.toml`, run `supabase init` and commit it; not confirmed in the docs); (3) revoke the old access token behind the `SUPABASE_ACCESS_TOKEN` environment secret, and remove that secret, once no session needs to change the project.
- ops | Delete the retired Claude artifact (ADR-0008), after exporting a backup from it.
- account | No real sign-in has been tried on the live page since ADR-0011 to ADR-0013 (only the fake client): Google's button in both schemes, the return after signing in from a tooltip, the upload of the browser's offers, «Compartir y comparar» in Comparar.
- ux | Comparar shows a guest two sign-in prompts until the tooltip is dismissed: the tooltip and «Otros pastores» (ADR-0013).
- db | Once a screen groups offers by place ("what each province pays"): promote `terms->>'province'` to a generated column or a view, respecting row-level security, in a migration.
- law | Owner check: which unemployment rate applies to a temporary contract. `ssOf` uses Orden PJC/297/2026 art. 34.1.b (eventual: 1.60 % worker, 6.70 % employer); the same article gives 7.05 % in total for «contratos de duración determinada». See the note in `law.js`.
- law | Owner check: the accident rate (AT/EP) for livestock work is 3.3 % in `law.js`, not verified against the 2026 premium tariff (DA 61ª); a secondary source gives 2.60 % for CNAE 01.
- law | Owner decision: annual working hours depend on the province's farm agreement (1,826 h is Granada's, expired at the end of 2025; Huesca about 1,760 h). With offers now carrying a province, `annualHours` could follow it, with each agreement cited; until then it is a reference figure.
- law | The Granada agreement is linked to a CCOO summary, not to the BOP Granada nº 229 (1 December 2023) itself: link the official text when found.
- offer | A comarca for each offer, if a view by area needs it: the Ministry of Agriculture's «comarcas agrarias» are the only nationwide set (download page unverified), joined by INE municipality code; IGN's gazetteer has none.
- offer | Swap GeoNames for IGN's gazetteer (CNIG, behind a download form; more hamlets, same municipality codes), if hamlets turn out to be missing.
- privacy | Owner decision: since `offerOnly` (an offer only offered, not worked) moved to the shepherd's own figures, other shepherds no longer see the «Solo oferta» label that ADR-0006 promised (ADR-0017). Keep it private, or share it as a label again.
- privacy | Owner decision: deleting the account keeps the offers in the browser (as its confirmation says); on a shared phone, the next person to sign in would upload them as theirs. Clear them too, or keep them and warn.
- account | An edit made in the instant between the flush before signing out and the sign-out completing is still lost.
- ui | Owner decision: segmented controls (`.seg`: hora/día/mes/total, sí/no…) are 36–37 px tall; buttons, tabs and chips are now at least 40 px. Raise them too, at the cost of a taller form?
- ui | Owner decision: labels on the over-time chart («Lo que ganas… en el tiempo») collide when offers overlap («Puerto A» on «Puerto A, otra cuenta»), worse at 320 px. Offset them, use a legend, or numbered markers?
- ui | Since ledger totals are the sum of the rows as shown, a total can differ by 1 € or a cent from the same figure elsewhere (e.g. «Ganas» in «Desglose» against the big number). Decide whether the headline should follow the ledger.
- arch | Owner decision: `views/form.js` and `views/settings.js` import `$`/`$$` from `ui/dom.js`, against the layer order in `AGENTS.md`. Move `dom.js` below views, or allow it for the two views that fill static markup.
- arch | Owner decision: `storage/backup.js` paints messages and selects offers (a UI controller), so `storage/` is not persistence only. Split it, or record that storage sits with ui by design.
- scripts | `scripts/` is outside Biome's `includes`, so `scripts/build-places.js` is not linted.
