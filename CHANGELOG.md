# Changelog

All notable changes to this product are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/spec/v2.0.0.html). Versions stay at 0.x until the cut-over, which is 1.0.0.

## [Unreleased]

### Added

- Architecture decision records 0001–0018 and the product requirements document.
- Devlog template.
- ADR 0019: backend structure and local development.
- ADR 0020: secrets in GitHub Environments, replacing ADR 0009.
- The admin panel at `/admin`, protected by Cloudflare Access: the Worker verifies the Access token of every admin request and answers 403 without one. Locally it opens with a fixed identity.

### Changed

- The brand is written enmirumbo, lowercase and in one word.
