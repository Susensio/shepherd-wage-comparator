# State

## App bar, a settings page of its own, and the text pass

Decided with the owner on 31 October 2026, after header mock-ups at 375 px (option B). Narrows ADR-0011 (one account page holding the settings); record in ADR-0012 when done.
Work stays on branch `ccr-32fbee75-oc1p8v`; `master` is published only when the owner says so.

### Design

- App bar on every screen, replacing the top bar and the big header title: the sheep as the logo (still bleats when tapped), «Comparador de jornales» with «Para pastores y pastoras» under it, then a cog button and the account button. The intro paragraph stays below; the tooltip still hangs from the account button.
- The cog opens a settings page: «Tus datos», «Supuestos», «Copia de seguridad», with «Volver», its own history entry and scroll restore, as the account page has. A line says where they are kept: «Se guardan en tu cuenta.» signed in, «Se guardan solo en este navegador.» for a guest with a project; none without a project.
- The account page holds only the account: sign-in for a guest; signed in, who, status, «Salir», the profile, sharing, deleting the account. Without a project there is no account button, only the cog.
- Sharing in the account page said once: heading «Otros pastores», switch «Compartir tus ofertas», one state line.
- Google's button uses Google's dark theme in dark mode.
- The email code gets an «Enviar otro código» button.
- The text pass: the audit of 31 October (voice, first person, the page talking about itself, repetitions, wrong statements) with its terminology: «Entrar» / «Salir»; «compartir tus ofertas» / «dejar de compartir»; «otros pastores»; «se ven»; «Reintentar» on buttons, «Inténtalo de nuevo» in messages; infinitive buttons, never first person; no Google outside its button and fallback. Tooltip «Guarda tus ofertas en una cuenta.»; one label «Compartir y comparar» in Comparar.

### Plan

1. App bar, cog and settings page, account page trimmed, sharing block de-duplicated, Google's dark button, «Enviar otro código». Browser tests.
2. The text pass across the page, the views and the messages. Tests updated to the new wording.
3. ADR-0012; `README.md`, `AGENTS.md`, `docs/model.md` in line; screenshots at 375 px in light and dark for the owner; then delete this section.
