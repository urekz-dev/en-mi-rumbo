// The responsive collapse guard of docs/specs/base-layout.md, requirement
// "Mobile-first design with no horizontal scroll": no class that forces a
// single line, clips labels, sets a minimum width other than min-w-0 or a
// width in pixels, and every grid starts with one column. Shared by the check
// of the components' code (test/scripts/design-tokens.test.ts) and the one of
// the served HTML (test/e2e/surfaces.spec.ts).

const VARIANTS = String.raw`(?:[a-z0-9-]+:)*`;

const FORBIDDEN: readonly [RegExp, string][] = [
  [new RegExp(`^${VARIANTS}(?:whitespace-nowrap|text-nowrap)$`), "forces the text onto one line"],
  [new RegExp(`^${VARIANTS}(?:truncate|text-ellipsis)$`), "clips the label"],
  [
    new RegExp(`^${VARIANTS}overflow-x-(?:auto|scroll)$`),
    "hides the overflow instead of collapsing",
  ],
  [new RegExp(`^${VARIANTS}flex-nowrap$`), "keeps the row from wrapping"],
  [new RegExp(`^${VARIANTS}min-w-(?!0$)`), "sets a minimum width other than min-w-0"],
  [new RegExp(`^${VARIANTS}(?:min-|max-)?w-\\[[^\\]]*px\\]$`), "sets a width in pixels"],
  [/^grid-cols-(?:[2-9]|1[0-2])$/, "sets columns without a breakpoint"],
];

/** What blocks the collapse in the class attribute of one element. */
export function collapseProblems(classAttribute: string): string[] {
  const classes = classAttribute.split(/\s+/).filter(Boolean);
  const problems = classes.flatMap((name) =>
    FORBIDDEN.filter(([pattern]) => pattern.test(name)).map(([, why]) => `"${name}" ${why}`),
  );
  const columns = classes.some((name) => /(?:^|:)grid-cols-/.test(name));
  if (classes.includes("grid") && columns && !classes.includes("grid-cols-1")) {
    problems.push(`"${classAttribute}" is a grid that does not start with one column`);
  }
  return problems;
}
