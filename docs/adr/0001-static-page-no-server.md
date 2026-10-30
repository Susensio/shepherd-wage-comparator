# ADR-0001: Keep offers in the browser, with optional Claude-account sync, instead of running a server

Status: Superseded by [ADR-0006](0006-supabase-accounts-per-user-sharing.md)
Date: 2026-10-30

## Context

The page compares a shepherd's job offers, and an offer holds personal pay data. By 30 October 2026 it was a static page with no backend. Offers were saved in `localStorage`; when the page ran as a claude.ai artifact they were also synced to the user's Claude account document, and the most recent copy won.

## Decision

Offers stayed in the browser, with the Claude-account sync as an extra that only works inside the artifact. No server, database or account system of our own was run.

## Consequences

- Nothing to host or maintain, and nobody but the user sees their offers.
- The browser can delete `localStorage`, so the page reminds the user to save a backup file.
- Data cannot be shared across devices outside the Claude account, and cannot be pooled across users. Joint visualisations would need a server and accounts, which is a new decision superseding this one (see `docs/BACKLOG.md`).
