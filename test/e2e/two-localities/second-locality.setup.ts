// Setup of the "two localities" projects (playwright.config.ts).
import { test as setup } from "@playwright/test";
import { addSecondLocality } from "./second-locality.ts";

setup("a second, fictitious locality is active", async () => {
  await addSecondLocality();
});
