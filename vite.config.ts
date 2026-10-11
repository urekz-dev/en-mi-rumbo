// Vite+ configuration: tests, lint, format, staged files and tasks.
// Astro has its own configuration in astro.config.mjs and ignores this file,
// so `vp dev`, `vp build` and `vp preview` do not run Astro: use the
// `vp run dev`, `vp run build` and `vp run preview` tasks below.
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vite-plus";

const generated = ["dist/**", ".astro/**", "worker-configuration.d.ts"];

export default defineConfig({
  test: {
    projects: [
      {
        // Runs inside workerd with the bindings from wrangler.jsonc.
        plugins: [
          cloudflareTest({
            main: "./test/worker/entry.ts",
            wrangler: { configPath: "./wrangler.jsonc" },
          }),
        ],
        test: {
          name: "workers",
          include: ["test/worker/**/*.test.ts"],
        },
      },
    ],
  },
  lint: {
    ignorePatterns: generated,
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {
    // Prettier formats .astro files (prettier.config.mjs).
    ignorePatterns: [...generated, "**/*.astro", "pnpm-lock.yaml"],
  },
  staged: {
    "!(*.astro)": "vp check --fix --no-error-on-unmatched-pattern",
    "*.astro": ["vp lint --fix", "prettier --write"],
  },
  run: {
    tasks: {
      dev: { command: "astro dev", cache: false },
      build: { command: "astro build", cache: false },
      preview: { command: "astro preview", cache: false },
      // Regenerates worker-configuration.d.ts after a change to wrangler.jsonc.
      types: { command: "wrangler types", cache: false },
      // `vp check` cannot run astro check or Prettier, so this task adds them.
      "check:all": {
        command: [
          "vp check",
          'prettier --check "**/*.astro"',
          "astro check",
          "wrangler types --check",
        ],
        cache: false,
      },
      "fmt:astro": { command: 'prettier --write "**/*.astro"', cache: false },
      // End-to-end tests against `astro preview` (workerd); builds first.
      e2e: { command: "playwright test", dependsOn: ["build"], cache: false },
    },
  },
});
