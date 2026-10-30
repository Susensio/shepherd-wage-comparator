# State

## Accounts and shared offers

Settled in conversation on 30 October 2026, not yet recorded in ADRs or started.
Replaces the `auth` entry that was in `docs/BACKLOG.md`.

### What was decided

- Three tiers, each a choice of the user:
  - anonymous: offers in the browser only, as today, no network;
  - account: Google login (other providers later; Facebook needs Meta app review), offers and settings saved to the account and restored on any device;
  - sharing: one switch per user, not per offer.
    On, every offer of that user is shared, worked ones and offer-only ones, the latter labelled «Solo oferta».
- Backend: Supabase (Postgres, row-level security, Google OAuth), EU region.
- Reading other people's offers requires being signed in, having sharing on and at least one offer: no zombie readers.
  The `anon` role reads nothing.
- Shared offers are fully public to those readers, together with who shared them: name and email from the OAuth account plus profile fields such as a phone number, so shepherds can talk to each other.
  Turning sharing off hides them and also removes the user's own access.
- The offer is split at the source, not in the storage adapter: `{ id, terms, mine }`.
  - `terms`, what the employer offers and the only part ever shared: contract, start, year, duration, hours, days off, holidays, payroll minimum, pay, extra pays, vacation, cash, total, overnight, housing, meals given, `kmRate`, `offerOnly`.
  - `mine`, about the shepherd and never shared: `name`, `kmHome`, `kmWorkPerDay`, `tripsHome`, `car`, `commute`, `expenses`, `rentValue`, `irpfMode`, `irpfManual`.
  - `cfg` stays the user's own settings, saved to the account, never shared.
- Comparing with other people: other people's offers are calculated from `terms` with a neutral `mine` (no km, trips or expenses, automatic IRPF, nothing else earned in the year).
  Own offers can show the same terms-only figures, so like is compared with like.
  Today the personal fields reach the model only in `model/pay.js` (car cost) and `model/calc.js` (`expenses`).
- The Claude artifact is retired, with its Claude-account sync (`storage/cloud.js`). GitHub Pages is the only home.
- Prototype stage: no conversion of the current saved format (ADR-0005). Shared rows still carry `schema_version` from the start, because other people's offers must keep loading after the format changes.

Still open, to settle in the ADR: vendoring `@supabase/supabase-js` (OAuth PKCE and session refresh come with it; AGENTS.md says lit-html is the only library) or calling the REST and auth endpoints with `fetch`.
The recommendation is to vendor it.

### Plan

1. ADRs: accounts and per-user sharing (supersedes ADR-0001, settles the library), the `terms` / `mine` offer shape, retiring the artifact.
2. Export a backup from Ajustes, then refactor the offer to `{ id, terms, mine }` across `offer.js`, `model/`, `views/`, `saved.js`, the fixtures and the tests.
   Saved data breaks; nothing converts it.
3. A terms-only calculation (neutral `mine`) in `model/`, and a way to show it for own offers.
4. Retire the artifact: delete `storage/cloud.js` and the cloud status in Ajustes, the `window.claude` paths, and the artifact paragraphs in `AGENTS.md` and `README.md`.
   Deleting the published artifact is the owner's call.
5. Owner: create the Supabase project (EU region), enable Google login with redirect URLs for GitHub Pages and `http://localhost:8000`, and hand over the project URL and anon key (public by design; RLS is what protects the data).
6. `supabase/schema.sql`:
   - `profiles(user_id, name, email, phone, …, sharing)`, readable by readers only for sharing users;
   - `settings(user_id, cfg)`, owner only;
   - `offers(id uuid, user_id, terms jsonb, schema_version, updated_at)`, owner, plus readers when the owner shares;
   - `offer_mine(offer_id, mine jsonb)`, owner only;
   - `can_read()`, `security definer`: caller signed in, sharing on, at least one offer.
   Decide how the RLS is tested (Supabase CLI locally, or a script against a test project).
7. `storage/account.js`: sign in and out, load and save through `ingestSaved`, first login offering to upload the browser's offers.
   To decide here: conflicts per offer (latest `updated_at` wins) and how deletions reach the server.
8. Ajustes: profile fields, the sharing switch with a plain text of exactly what becomes visible and to whom, and deleting the account with all its data.
9. A view of other people's offers, compared on terms-only figures, with who shared them and how to contact them.
10. Bring `README.md`, `AGENTS.md` (structure, saved data, commits) and `docs/model.md` in line, then delete this section.
