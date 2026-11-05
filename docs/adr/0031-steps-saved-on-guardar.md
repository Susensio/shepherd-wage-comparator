# ADR-0031: A changed step is saved on «Guardar», not as it is typed

Status: accepted (5 November 2026). Amends [ADR-0020](0020-guided-entry-and-ficha.md).

## Context

Every change to an offer was saved at once, and «Cancelar» put the old values back by saving again. So a step changed and then cancelled had already reached `localStorage` and, signed in, the account (and other shepherds, if the offer is shared). A reload, a closed tab or a lost connection mid-edit kept the change with no way left to cancel it. Going back to the templates and tapping one silently replaced everything typed in the later steps.

## Decision

- Opening a step from the ficha holds the saving of offers (`offers.hold`). The page shows and calculates the edits in memory; nothing is written or synced. «Guardar» saves once (`offers.release(true)`); «Cancelar», Back and «Cerrar» put the copy taken on opening back and write nothing (`release(false)`). If the account replaces the offers meanwhile, the held step is abandoned.
- A new offer is still saved on every change: it exists from the template on, and «Cerrar» keeps it, as before.
- In a new offer, tapping a template again after something was typed warns first («Cambiar de plantilla borra lo ya escrito. Para seguir, toca la plantilla otra vez.») and changes it only on the second tap.

## Consequences

- A reload while a step is open loses what was typed in it, which is what «Cancelar» would have done.
- Alternative not taken: keep saving live and add an undo. It leaves the intermediate values synced and shared.
