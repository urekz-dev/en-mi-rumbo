// Scenarios of docs/specs/base-layout.md, requirement "Deployed environments
// stay out of search engines until the cut-over (v2)". src/worker.ts applies
// withRobotsPolicy to every response and src/pages/robots.txt.ts serves
// robotsTxt; the end-to-end tests cover the local behaviour through the build.
import { describe, expect, it } from "vite-plus/test";
import { ADMIN_HEADERS, forbiddenResponse } from "../../src/lib/access/admin-gate.ts";
import { blocksIndexing, robotsTxt, withRobotsPolicy } from "../../src/lib/robots.ts";

const DEPLOYED = ["dev", "stage", "prod"] as const;

function page(headers: Record<string, string> = {}): Response {
  return new Response("<!doctype html><title>enmirumbo</title>", {
    headers: { "Content-Type": "text/html; charset=utf-8", ...headers },
  });
}

describe("Deployed environments stay out of search engines until the cut-over (v2)", () => {
  it.for(DEPLOYED)("any response of %s carries X-Robots-Tag: noindex", (environment) => {
    expect(blocksIndexing(environment)).toBe(true);
    for (const response of [
      page(),
      new Response("Not found", { status: 404 }),
      new Response(null, { status: 500 }),
      Response.json({ ok: true }),
    ]) {
      const result = withRobotsPolicy(response, environment);
      expect(result.headers.get("X-Robots-Tag")).toBe("noindex");
      expect(result.status).toBe(response.status);
    }
  });

  it("a response with immutable headers is copied with the header", () => {
    // The headers of a redirect made with Response.redirect are immutable, like
    // those of a response that comes from fetch().
    const redirect = Response.redirect("https://enmirumbo.urekz.workers.dev/", 302);
    expect(() => redirect.headers.set("X-Test", "1")).toThrow();

    const result = withRobotsPolicy(redirect, "prod");

    expect(result.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(result.status).toBe(302);
    expect(result.headers.get("Location")).toBe("https://enmirumbo.urekz.workers.dev/");
  });

  it.for(DEPLOYED)("the panel keeps its stricter value in %s", (environment) => {
    const response = withRobotsPolicy(forbiddenResponse(), environment);
    expect(response.headers.get("X-Robots-Tag")).toBe(ADMIN_HEADERS["X-Robots-Tag"]);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it.for(DEPLOYED)("robots.txt closes the whole site in %s", (environment) => {
    expect(robotsTxt(environment)).toBe("User-agent: *\nDisallow: /\n");
  });

  it.for([undefined, "", "production", "Local", " local"])(
    "an unknown or missing environment (%j) counts as deployed",
    (environment) => {
      expect(blocksIndexing(environment)).toBe(true);
      expect(withRobotsPolicy(page(), environment).headers.get("X-Robots-Tag")).toBe("noindex");
      expect(robotsTxt(environment)).toBe("User-agent: *\nDisallow: /\n");
    },
  );

  it("local: no header, and robots.txt allows the site except the panel", () => {
    expect(blocksIndexing("local")).toBe(false);
    const response = page();
    expect(withRobotsPolicy(response, "local")).toBe(response);
    expect(response.headers.has("X-Robots-Tag")).toBe(false);
    expect(robotsTxt("local")).toBe("User-agent: *\nDisallow: /admin\n");
  });
});
