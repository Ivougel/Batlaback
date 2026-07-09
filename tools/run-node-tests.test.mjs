/**
 * Vitest-обёртка для node-only тестов (без Playwright).
 * Сохраняет существующие *.test.mjs без переписывания.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** @type {string[]} */
const NODE_TESTS = [
  "item-pool-120.test.mjs",
  "meta-progress.test.mjs",
  "placement-slots.test.mjs",
  "mutation-capstones.test.mjs",
  "mutation-ui.test.mjs",
  "lobby-mutations.test.mjs",
  "mutation-progress-hints.test.mjs",
];

describe("game logic (node)", () => {
  for (const file of NODE_TESTS) {
    it(file, () => {
      const script = path.join(ROOT, "tools", file);
      const result = spawnSync(process.execPath, [script], {
        cwd: ROOT,
        encoding: "utf8",
        env: { ...process.env, FORCE_COLOR: "0" },
      });
      if (result.status !== 0) {
        const out = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
        throw new Error(out || `${file} exited with code ${result.status}`);
      }
    });
  }
});
