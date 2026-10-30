# ADR-0002: Freeze the storage keys and the account document path, and convert old formats on read

Status: Accepted
Date: 2026-10-30

## Context

Offers and settings were stored in `localStorage` (keys in `KEY`, `state.js`), in backup files and in the Claude account document `data/users/<id>/estado`. In October 2026 the saved field names changed from Spanish to English, and people already had offers saved with the old names.

## Decision

The storage keys and the account document path are never changed. Any change to the saved format is absorbed on read: `legacy.js` converts the old shape when loading from `localStorage`, from a backup and from the account. `test/e2e/legacy.spec.js` covers all three.

## Consequences

- Nobody loses offers when the format moves on.
- `legacy.js` only grows: every renamed field or value leaves a mapping behind, and each needs a test case.
- Any future store (for example accounts on a server) has to ingest the old shapes too, not only the current one.
