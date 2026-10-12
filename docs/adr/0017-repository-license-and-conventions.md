# ADR 0017: Public repository, all rights reserved, and working conventions

- Status: accepted
- Date: 2026-10-11
- Owner: Alexis Zazueta

## Context

The product is built in public: people can read the code and the devlog. The founder wants nobody to be able to use or modify the code. GitHub's terms allow viewing and forking any public repository, and forks of public repositories cannot be disabled. Public repositories on the free plan get rulesets, required reviews and unlimited Actions minutes, which private ones do not.

## Decision

The repository `urekz-dev/enmirumbo` becomes public. It carries a proprietary notice in `LICENSE`: the source is published to be read; no permission is granted to use, copy, modify or distribute it. The copyright holders are the people named in the notice, since the collective is not a legal entity. External contributions are not accepted. Conventions: one trunk `main`; one short branch per Plane work item named `EMR-<n>-<description>`; pull request titles start with the work item key; squash merge; one reviewer other than the author; signed commits; rulesets protect `main` and production tags. Specifications, ADRs, README, code, commit messages and Plane work items are in English; UI copy is in Mexican Spanish. The copyright holders named in the notice are Alexis Zazueta and Jorge Pilo. The seven specifications live in `docs/specs/` as living documents changed in the same pull request as the code, without a change-proposal workflow; a behaviour change big enough to discuss lands first as a docs-only pull request. Agents implement work items and leave a receipt in the pull request (what they read, changed, verified and what it cost).

## Consequences

Before flipping visibility, internal identifiers are removed from the README and the history is checked. Dependencies remain under their own licences; no copyleft code is vendored into the repository.
