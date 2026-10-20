import { cleanupBrowserFixture, disconnectBrowserFixture, setupBrowserFixture } from "./browser-fixture";

setupBrowserFixture()
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : "BROWSER_FIXTURE_SETUP_FAILED");
    try {
      await cleanupBrowserFixture();
    } catch (cleanupError) {
      console.error(cleanupError instanceof Error ? cleanupError.message : "BROWSER_FIXTURE_CLEANUP_FAILED");
    }
    process.exitCode = 1;
  })
  .finally(disconnectBrowserFixture);
