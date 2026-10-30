# ADR-0003: Use native ES modules with no build step instead of a framework or bundler

Status: Accepted
Date: 2026-10-30

## Context

The page started as classic scripts sharing one global scope. As it grew it needed files with explicit dependencies and templates that did not build HTML from strings. A framework such as React, and a bundler, were considered.

## Decision

The code was rewritten as native ES modules with no build step: what is edited is what runs. A framework was ruled out because one view with simple state does not need one. Types are checked from JSDoc (`checkJs`) and nothing is compiled.

## Consequences

- The repository needs no build tooling beyond Biome and `tsc`.
- The page no longer opens from `file://` and has to be served over http.
- A framework or bundler would reverse this decision; adding a library that works as a plain module does not.
