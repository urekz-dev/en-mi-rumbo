# ADR 0001: Record architecture decisions

- Status: accepted
- Date: 2026-10-11
- Owner: Alexis Zazueta

## Context
enmirumbo is rebuilt from scratch and built in public. Many technical choices (hosting, data, security, testing) affect the product for years. Without a record, the reasons behind them are lost in chats and pull requests, and people revisit settled questions.

## Decision
We record significant architecture decisions as short ADRs in `docs/adr/`.

- Each ADR has a number, assigned in order. Numbers are never reused or renumbered.
- A decision that changes is not edited. A new ADR supersedes it, and the old ADR gets the status `superseded by ADR NNNN`.
- A new ADR is added in the same pull request as the change it records.
- The template is `docs/adr/template.md`.

## Consequences
Anyone can see why the system looks the way it does, and in what order decisions were made. Writing an ADR adds a small step to each significant change. Small choices that are easy to reverse do not need an ADR.
