// The astro test project: renders pages, layouts and components with Astro's
// Container API (experimental) in Node, with whatever Astro.locals a test
// gives, such as the locality the middleware sets. Astro's own Vite
// configuration compiles the components; astro.config.mjs is not loaded, so
// neither is the Cloudflare adapter, and `cloudflare:workers` is a stand-in
// (./cloudflare-workers.ts). Listed in the projects of vite.config.ts.
import { fileURLToPath } from "node:url";
import { getViteConfig } from "astro/config";

const root = fileURLToPath(new URL("../..", import.meta.url));

export default getViteConfig(
  {
    resolve: {
      alias: {
        "cloudflare:workers": fileURLToPath(new URL("./cloudflare-workers.ts", import.meta.url)),
      },
    },
    test: {
      name: "astro",
      environment: "node",
      root,
      include: ["test/astro/**/*.test.ts"],
    },
  },
  { configFile: false, root, output: "server", logLevel: "error" },
);
