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
- format | `src/views/result.js` still compares `r.pay.irpf - r.pay.irpfYear > 1` directly; it is the same euro slack as `isWorthCounting` in `format.js`.
- account | «Perfil guardado.» shows in the orange warning style of the account section's error line; a success needs its own style.
