/**
 * Тесты подсказок прогресса мутации.
 * Запуск: node tools/mutation-progress-hints.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function loadSandbox() {
  const sandbox = {
    console,
    Math,
    Object,
    Array,
    JSON,
    Number,
    String,
    Boolean,
    document: {
      getElementById: () => null,
    },
    prepViewSide: "player",
    getSideMutationRuntime: () => ({
      classId: "mage",
      companionId: "s_stranger",
      items: [],
    }),
  };
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const file of ["classes.js", "systems/mutations.js", "systems/mutation-progress-hints.js"]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx);
  }
  vm.runInContext(
    `
    Object.assign(globalThis, {
      captureMutationProgressSnapshot,
      diffMutationProgressSnapshots,
      buildMutationProgressHint,
      notifyPrepMutationProgressChange,
      resetMutationProgressHintTracking,
      MUTATION_HINT_DELTA_THRESHOLD,
    });
  `,
    ctx,
  );
  return sandbox;
}

function run() {
  const s = loadSandbox();
  let passed = 0;

  const progressBefore = {
    leader: { id: "m_sage", name: "МУДРЕЦ", pct: 18 },
    leaderShare: 0.18,
    ranked: [
      { id: "m_arcanist", name: "АРКАНИСТ", pct: 19 },
      { id: "m_sage", name: "МУДРЕЦ", pct: 18 },
    ],
    tagCounts: { gem: 2, magic: 1 },
  };
  const progressAfter = {
    leader: { id: "m_arcanist", name: "АРКАНИСТ", pct: 28 },
    leaderShare: 0.28,
    ranked: [
      { id: "m_arcanist", name: "АРКАНИСТ", pct: 28 },
      { id: "m_sage", name: "МУДРЕЦ", pct: 14 },
    ],
    tagCounts: { gem: 5, magic: 3 },
  };

  const before = s.captureMutationProgressSnapshot(progressBefore);
  const after = s.captureMutationProgressSnapshot(progressAfter);

  const diff = s.diffMutationProgressSnapshots(before, after);
  assert(diff.leaderChanged, "diff: leader changed");
  assert(
    diff.branchDeltas.some((row) => row.id === "m_arcanist" && row.delta === 9),
    "diff: arcanist +9",
  );
  passed++;

  const hint = s.buildMutationProgressHint(diff, before, after, { itemId: "mana_crystal" });
  assert(hint?.eyebrow.includes("АРКАНИСТ"), "hint: new leader");
  assert(hint?.eyebrow.includes("28%"), "hint: new pct");
  passed++;

  s.resetMutationProgressHintTracking();
  const silent = s.notifyPrepMutationProgressChange(progressBefore);
  assert(silent == null, "notify: first snapshot silent");
  passed++;

  s.getSideMutationRuntime = () => ({
    classId: "mage",
    companionId: "s_stranger",
    items: [{ itemId: "mana_crystal" }],
  });
  const deltas = s.notifyPrepMutationProgressChange(progressAfter, { itemId: "mana_crystal", cause: "buy" });
  assert(deltas?.m_arcanist === 9, "notify: returns active deltas");
  passed++;

  console.log(`mutation-progress-hints.test.mjs: ${passed}/${passed} OK`);
}

run();
