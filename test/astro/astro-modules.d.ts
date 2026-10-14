// `vp check` type checks with TypeScript alone, which cannot read .astro files
// (`astro check` can). The container tests import pages and layouts, so for
// TypeScript an .astro module is a component the container renders.
declare module "*.astro" {
  const component: Parameters<
    import("astro/container").experimental_AstroContainer["renderToString"]
  >[0];
  export default component;
}
