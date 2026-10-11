// @ts-check
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    // Photos are transformed on upload (ADR 0011), not by Astro, so the
    // adapter does not add an IMAGES binding.
    imageService: "passthrough",
  }),
  // No sessions, so the adapter does not require a KV binding.
  session: false,
  vite: {
    plugins: [tailwindcss()],
  },
});
