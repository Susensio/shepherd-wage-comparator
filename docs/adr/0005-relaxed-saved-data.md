# ADR-0005: Allow breaking saved data while the app has one user, instead of freezing storage keys

Status: Accepted
Date: 2026-10-30
Supersedes: [ADR-0002](0002-frozen-storage-keys.md)

## Context

ADR-0002 froze the storage keys and the account document path, and required every renamed field to be converted on read, because people would lose their offers. On 30 October 2026 the owner was the only person using the app, and the project was a prototype. Conversion code (`legacy.js`, its tests, the Spanish-era mappings) cost effort on every change to the saved format and protected nobody but the owner, who can export a backup.

## Decision

While the app has a single user, a change to the saved format may break existing saved data. Nothing has to be converted on read for new changes, and the storage keys may change. Before such a change the owner exports a backup from Ajustes. The conversions that exist stay in `legacy.js` until someone removes them; removing them is a separate, later change.

## Consequences

- Changes to saved fields, values and keys need no mapping and no extra test case.
- Anyone else who has saved offers could lose them. This holds only while the owner is the sole user; the first other user, or accounts on a server (see `docs/BACKLOG.md`), bring the obligation back and need a new decision.
- The live file for the current rule is the Saved data section of `AGENTS.md`.
