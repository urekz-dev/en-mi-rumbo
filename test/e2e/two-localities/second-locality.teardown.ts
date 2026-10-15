// Teardown of the "two localities" projects (playwright.config.ts).
import { test as teardown } from "@playwright/test";
import { removeSecondLocality } from "./second-locality.ts";

teardown("the second locality is gone", async () => {
  await removeSecondLocality();
});
