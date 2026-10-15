// @ts-check
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { staticNoindex } from "./src/integrations/static-noindex.ts";

// The build prerenders pages in a local workerd with the bindings of the
// target environment. Those of a deployed environment (CLOUDFLARE_ENV=dev,
// stage or prod) are real Hyperdrive configs with no local connection string,
// and workerd refuses to start without one. No prerendered page reads the
// database (docs/specs/deployment.md, "The production build does not need the
// database"), so the build gives them an address where nothing answers: a
// page that tried would fail the build. The deployed Worker never sees it.
if (process.env["CLOUDFLARE_ENV"]) {
  for (const binding of ["HYPERDRIVE", "HYPERDRIVE_FRESH"]) {
    process.env[`CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_${binding}`] ??=
      "postgres://prerender:none@127.0.0.1:9/no-database-at-build-time";
  }
}

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    // Photos are transformed on upload (ADR 0011), not by Astro, so the
    // adapter does not add an IMAGES binding.
    imageService: "passthrough",
  }),
  // Prerendered pages (the legal pages) are written as `<page>.html`, which
  // Cloudflare serves at `/<page>` with no trailing slash, like every other
  // URL of the site. As `<page>/index.html` they would answer a redirect to
  // `/<page>/`.
  build: { format: "file" },
  // Static assets skip the Worker, so a deployed build gives them its noindex
  // header through `_headers` (src/integrations/static-noindex.ts).
  integrations: [staticNoindex()],
  // No sessions, so the adapter does not require a KV binding.
  session: false,
  vite: {
    plugins: [tailwindcss()],
  },
});
