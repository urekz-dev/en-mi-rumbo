// @ts-check
// Prettier formats only .astro files, until Oxfmt supports them. Oxfmt
// (`vp fmt`, `vp check`) formats everything else and skips .astro files.
// The options match Oxfmt's defaults, so both produce the same style.

/** @type {import("prettier").Config} */
export default {
  printWidth: 100,
  plugins: ["prettier-plugin-astro"],
};
