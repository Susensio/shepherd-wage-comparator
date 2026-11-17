# ADR-0036: Tell «waiting for a payment» from «owed» by asking whether more payment is expected, instead of closing the record

Status: Accepted (owner, 17 November 2026)
Date: 2026-11-17
Amends: ADR-0032, ADR-0035

## Context

«Cerrar el registro» (ADR-0032) declared that every cobro was recorded, but a closed record still took cobros silently, and «Trabajo ya hecho» closed every past job at once. A usability review on 16 November 2026 found it behaved like nothing. The owner pointed at what matters: whether the shepherd is waiting for a payment or the ganadero owes money, since that decides what to do next (wait, remind, claim). Mock-ups compared three ways: a relaxed question «¿Falta algún cobro por apuntar?», a strong record with a real lock, and a state derived from the data («cuentas firmes»).

Weighed and discarded:
- A real lock on the record: a late cobro, the normal case after a claim, would need reopening first, and «cerrar» would mean two things (a month's days and the record).
- «¿Falta algún cobro por apuntar?»: it mixes «something is not recorded» with «more will be paid», and the page reads one answer as the other.
- Firmness derived from the data alone: it describes the data, not whether money is late.

## Decision

- A finished job with money missing asks «¿Se espera algún pago más?»: «Sí, quedó en pagarlo» (with an optional date) or «No». Unanswered, the job is «Por confirmar» (grey) and nothing is shown as owed in red.
- «Sí» makes it «Esperando cobro» (amber) until the promised date; after it, or on «No», it is «Debe el ganadero» (red) with the claim. Money missing is never red while it may only be unrecorded.
- Cobros are never locked: a late cobro is recorded and the state follows (Falta 0 is «Saldado»). Removing the last cobro takes the answer back.
- Closing a month stays the only lock: it freezes that month's days against changes to the offer. «Cerrar el registro» and «Reabrir el registro» go.
- The Expediente is dated and says when a cobro was recorded after «No».
- Saved format 9: `mine.record.expecting { by? }` beside `complete`, which keeps meaning «no more payment expected»; the two exclude each other.

## Consequences

- The list colours say what to do: grey to confirm, amber to wait, red to claim, green settled.
- One more question at the end of a job, asked only when money is missing.
- Format 9 makes open old pages reload (`min_page_version` 8).
