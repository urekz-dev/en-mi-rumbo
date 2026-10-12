# enmirumbo

A hyperlocal business directory, starting in Tizayuca, Hidalgo. Businesses register from a phone, a person verifies each one before it is published, and residents contact them through WhatsApp.

This repository is being rebuilt from scratch. The code is public for reading only; see [LICENSE](LICENSE). External contributions are not accepted; see [CONTRIBUTING.md](CONTRIBUTING.md).

- Product: [docs/PRD.md](docs/PRD.md)
- Specifications: [docs/specs/](docs/specs/)
- Decisions: [docs/adr/](docs/adr/)

## Stack

- [Astro](https://astro.build/) in server mode on Cloudflare Workers, through `@astrojs/cloudflare`. A custom Worker entry (`src/worker.ts`) sends requests to Astro and also handles the scheduled jobs.
- Tailwind CSS 4.
- [Vite+](https://viteplus.dev/) (`vp`) as the toolchain: pnpm, Oxlint, Oxfmt, Vitest and Vite Task. Prettier formats `.astro` files until Oxfmt supports them.
- Tests run inside workerd with `@cloudflare/vitest-plugin`; end-to-end tests use Playwright.

## Requirements

- [Vite+](https://viteplus.dev/guide/) installed globally. It provides Node.js 24 and pnpm 12, the versions declared in `package.json`.
- Git 2.32 or later.

## Run locally

```sh
vp install                           # dependencies and the pre-commit hook
vp exec playwright install chromium  # once, for the end-to-end tests
vp run dev                           # http://localhost:4321
```

The dev server, the build and the preview run Astro in workerd, the Workers runtime. Astro's commands are tasks: `vp dev`, `vp build` and `vp preview` run plain Vite and do not work in this project.

| Command            | What it does                                                                         |
| ------------------ | ------------------------------------------------------------------------------------ |
| `vp run dev`       | Starts the dev server at http://localhost:4321.                                      |
| `vp run build`     | Builds the site and the Worker into `dist/`.                                         |
| `vp run preview`   | Serves the build at http://localhost:4321.                                           |
| `vp check`         | Formats, lints and type checks.                                                      |
| `vp run check:all` | Runs `vp check`, Prettier on `.astro` files, `astro check` and a Worker types check. |
| `vp test`          | Runs the tests inside workerd.                                                       |
| `vp run e2e`       | Builds, then runs the Playwright tests against the preview.                          |
| `vp run fmt:astro` | Formats `.astro` files with Prettier.                                                |
| `vp run types`     | Regenerates `worker-configuration.d.ts` after a change to `wrangler.jsonc`.          |

To run the scheduled handler while `vp run dev` is running:

```sh
curl "http://localhost:4321/cdn-cgi/local/scheduled?cron=0+*+*+*+*"
```

Deployment to Cloudflare arrives with the stories that add the environments and the workflows, and this README will describe it then.
