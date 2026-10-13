// Types of Astro's virtual modules (`astro:middleware`, `astro:actions`) for
// `vp check`, which does not read the generated .astro/types.d.ts.
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Set by the middleware once a panel request passes the Access check (ADR 0010). */
    admin?: import("./lib/access/verify.ts").AdminIdentity;
  }
}
