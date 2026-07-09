import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tools/run-node-tests.test.mjs"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
