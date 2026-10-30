# Backlog

- auth | Accounts, probably with Supabase, to store each user's offers on a server instead of only in the browser or the Claude account.
  Goal: aggregate data across users for joint visualisations.
  Open: what is stored and whether it is anonymised, consent for pooling, how existing `localStorage` offers migrate in (the storage keys cannot change, see AGENTS.md).
- modes | Split the app into stages of the process instead of one analysis view. Today the analysis comes first and the other tabs help with later stages.
  Not designed yet. Stages to explore: analysis (current), negotiation, signing.
- modes | Negotiation mode: build on `views/negotiate.js` to lead a conversation with the employer.
- modes | Signing mode: generate a PDF of the agreed conditions, asking for whatever is still missing so nothing is left undefined and there are no surprises afterwards.
  Open: which fields a contract must fix (wage, hours, night stays, rest, holidays, accommodation, who pays what), PDF generation without a build step.
- ai | A small AI agent that helps through the whole process (understand an offer, negotiate, fill the missing conditions).
  Open: where the model runs and who pays for it, what personal data may leave the browser, how to keep answers tied to `law.js` instead of invented figures.
