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
- shared | Next in line, with the sign-out leak above. The read-only view of another shepherd's offer and their ranking rows still speak to the reader («¿Cuánto ganas?», «te deben»), though the offer is someone else's.
- shared | Two sharers' offers with the same name look alike in the head-to-head table.
- account | A browser signed out of one account and into another uploads the first account's offers still cached there into the second (ADR-0009); with sharing on, other shepherds then see them as the second user's. Clearing the cache on sign-out would fix it, at the cost of an empty page after signing out (the page can say the offers are safe in the account). Next in line, with the shared view below.
- account | Sign-in by emailed code is built but off (`emailSignIn` in `storage/account-config.js`, ADR-0009). To turn it on: a custom SMTP sender in Supabase (Resend's free plan, 100 emails a day, is enough; store its API key as an environment secret so a session can configure it), then the «Magic link» and «Confirm signup» templates in Spanish with `{{ .Token }}` (the code is already 6 digits), then `emailSignIn: true` and a real sign-in. Supabase's built-in sender reaches only the project's team, two emails an hour, and its templates cannot be changed on the free plan.
- account | Google refused `http://localhost:8000` as an origin on 31 October 2026, though `https://susensio.github.io` worked: check the OAuth client's Authorized JavaScript origins before testing sign-in on a computer.
- ops | Revoke the Supabase access token behind the `SUPABASE_ACCESS_TOKEN` environment secret, and remove the secret, once no session needs to change the project.
- ops | Delete the retired Claude artifact (ADR-0008), after exporting a backup from it.
- account | No real sign-in has been tried on the live page since ADR-0011 to ADR-0013 (only the fake client): Google's button in both schemes, the return after signing in from a tooltip, the upload of the browser's offers, «Compartir y comparar» in Comparar.
- backup | The result of «Recuperar una copia» is a small grey line under the text box: on 31 October 2026 an import that added nothing looked like nothing happened. Make the result visible (and say when a file holds no offer it can read).
- ux | Comparar shows a guest two sign-in prompts until the tooltip is dismissed: the tooltip and «Otros pastores» (ADR-0013).
