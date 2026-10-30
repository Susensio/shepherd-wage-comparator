# State

## Accounts and shared offers

Decided in ADR-0006 (accounts, sharing, Supabase), ADR-0007 (offer as `{ id, terms, mine }`) and ADR-0008 (artifact retired).
No preview deploy: work stays on the branch and `master` is not touched until the feature is complete.

### Plan

1. Done: ADRs 0006–0008.
2. Done: retire the artifact: delete `storage/cloud.js`, the cloud status in Ajustes, the `window.claude` paths, and the artifact paragraphs in `AGENTS.md` and `README.md`.
   Deleting the published artifact, after exporting a backup from it, is the owner's call.
3. Done (storage key now `cj.ofertas2`, old data not read): refactor the offer to `{ id, terms, mine }` across `offer.js`, `model/`, `views/`, `saved.js`, the fixtures and the tests.
4. Done (switch in Comparar only, not in the result view): a terms-only calculation (neutral `mine`) in `model/`, and a way to show it for own offers.
5. Done, through the management API: `supabase/schema.sql` run on `https://etvrgexvjviavulflcqr.supabase.co`; auth site URL `https://susensio.github.io/shepherd-wage-comparator/`, redirect URLs that and `http://localhost:8000`; the project URL and publishable key in `src/storage/account-config.js`; the RLS rules of `test/unit/rls.test.js` checked against the real database (test users in one transaction, rolled back).
   Owner: the Google OAuth client (Google Cloud Console, redirect URI `https://etvrgexvjviavulflcqr.supabase.co/auth/v1/callback`), its ID and secret entered in Supabase under Google provider; then a first real sign-in. Revoke the access token `SUPABASE_ACCESS_TOKEN` and remove the environment secret.
6. Done, RLS tested offline with PGlite and once against the real project: `supabase/schema.sql`:
   - `profiles(user_id, name, email, phone, …, sharing)`, readable by readers only for sharing users;
   - `settings(user_id, cfg)`, owner only;
   - `offers(id uuid, user_id, terms jsonb, schema_version, updated_at)`, owner, plus readers when the owner shares;
   - `offer_mine(offer_id, mine jsonb)`, owner only;
   - `can_read()`, `security definer`: caller signed in, sharing on, at least one offer.
7. Done, tested only against a fake client; first sign-in with browser-only offers pauses sync until the UI calls `uploadPending()` or `discardPending()`: vendor `@supabase/supabase-js` from `dist/umd/supabase.js`; `storage/account.js`: sign in and out, load and save through `ingestSaved`, first login offering to upload the browser's offers.
8. Done, against a fake client only: Ajustes: sign in and out, the first-sign-in prompt (upload or discard the browser's offers), profile fields, the sharing switch with a plain text of exactly what becomes visible and to whom, and deleting the account with all its data.
9. Done, against a fake client only: a view of other people's offers, compared on terms-only figures, with who shared them and how to contact them.
10. Bring `README.md`, `AGENTS.md` (structure, saved data, commits) and `docs/model.md` in line, then delete this section.
