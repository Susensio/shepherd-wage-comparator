# ADR-0004: Count what an offer owes per item and month instead of netting one total

Status: Accepted
Date: 2026-10-30

## Context

An offer is checked against the legal minimum for salary, overnight bonus and vacation. Those could have been netted into one total, where extra pay in one item hides a shortfall in another. Part of the pay may also be in cash, which pays no Social Security.

## Decision

What an offer owes is counted item by item (salary, overnight bonus, vacation) and month by month. A surplus in one item does not cover a shortfall in another. Cash pay is subtracted from what is owed, but a payroll below the minimum is still marked illegal, because cash pays no Social Security.

## Consequences

- The figures match how the law measures each item, and a shortfall cannot be masked by generosity elsewhere.
- The ledgers are longer, and every `=` row has to add up on screen, which `test/e2e/consistency.spec.js` checks.
- The rules for extra days, overtime and unemployment benefit sit on top of this and are described in the model, not here.
