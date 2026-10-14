// Stand-in for `cloudflare:workers` in the astro test project, which renders
// components in Node rather than in workerd. Tests change `env` to render the
// layout as a given environment would.
export const env: Partial<Env> = { ENVIRONMENT: "local" };
