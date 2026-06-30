import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tools",
  testMatch: /layout-.*snapshots\.spec\.mjs/,
  snapshotPathTemplate: "{testDir}/snapshots/{testFilePath}/{arg}{ext}",
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.12,
      animations: "disabled",
    },
  },
  use: {
    colorScheme: "dark",
  },
});
