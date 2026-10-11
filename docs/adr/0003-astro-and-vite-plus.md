# ADR 0003: Astro with server rendering and Vite+ as the toolchain

- Status: accepted
- Date: 2026-10-11
- Owner: Alexis Zazueta

## Context
The site is mostly server-rendered HTML with forms, a few redirects and no client-side application state. The business commitment that the public site works without JavaScript rules out client frameworks for the main surface. The team standardises on Vite+ in its other projects. Vite+ requires its own `vite.config.ts`, which Astro ignores, and it cannot run `astro check`. Oxfmt does not format `.astro` files yet; its support is merged but unreleased. `@astrojs/check` supports TypeScript 5 and 6.

## Decision
We build the application with Astro in server mode on the `@astrojs/cloudflare` adapter, using `.astro` components, Tailwind 4 through `@tailwindcss/vite`, and Astro Actions with `accept: 'form'` for every mutation. No React or other client framework. Astro sessions are disabled (`session: false`), so no KV binding is provisioned. Code reads bindings with `import { env } from "cloudflare:workers"`.

Vite+ is the toolchain. `vite.config.ts` holds only the lint, format, staged, run and test configuration; Astro's configuration lives in `astro.config.mjs`. Astro's dev, build and preview commands run as `vp run` tasks. A `check:all` task chains `vp check` and `astro check`. Prettier with `prettier-plugin-astro` formats `.astro` files, which are excluded from Oxfmt until it releases Astro support. TypeScript 6 is installed for `astro check`; `vp check` uses the type checker bundled with Vite+. pnpm 12 is the package manager, pinned with `devEngines`; only `workerd` and `esbuild` may run install scripts.

## Consequences
One rendering model and almost no client JavaScript: the only scripts are the analytics beacon and the Turnstile widget. Pages that never change, such as the legal pages, are prerendered and served as static assets. Astro runs on the Vite build that Vite+ installs through its package override. The scaffold proves three integrations before anything is built on top: the custom Worker entry with a `scheduled` handler, Astro on the Vite+ build of Vite, and the Cloudflare test plugin on the Vitest bundled with Vite+. When Oxfmt ships Astro support, Prettier is removed.
