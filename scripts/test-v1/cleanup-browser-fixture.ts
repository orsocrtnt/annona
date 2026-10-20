import { cleanupBrowserFixture, disconnectBrowserFixture } from "./browser-fixture";

cleanupBrowserFixture()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "BROWSER_FIXTURE_CLEANUP_FAILED");
    process.exitCode = 1;
  })
  .finally(disconnectBrowserFixture);
