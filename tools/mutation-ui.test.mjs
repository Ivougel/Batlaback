/**
 * Тесты этапа 9: UI мутаций (галерея, бейдж, escape).
 * Запуск: node tools/mutation-ui.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function loadUiSandbox() {
  const sandbox = {
    console, Math, Object, Array, Map, Set, JSON, Number, String, Boolean,
    document: { getElementById: () => null },
  };
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const file of ["classes.js", "systems/mutations.js", "systems/mutation-lore-quips.js", "systems/mutation-ui.js"]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx);
  }
  vm.runInContext(`
    Object.assign(globalThis, {
      getMutationsForNoviceClass,
      getMutationById,
      getNoviceClassLabel,
      getMutationLoreQuip,
      formatMutationIntentLabel,
      buildClassMutationGalleryHtml,
      getPrepMutationBadgeMeta,
      renderLobbyMutationBadgeHtml,
      getLobbyFighterMutationEmoji,
      escapeMutationUiHtml,
      MUTATION_ROUND_FORM,
      MUTATION_ROUND_FINAL,
    });
  `, ctx);
  return sandbox;
}

function run() {
  const s = loadUiSandbox();
  let passed = 0;

  const priestMutations = s.getMutationsForNoviceClass("priest");
  assert(priestMutations.length === 8, "priest: 8 мутаций");
  passed++;

  const html = s.buildClassMutationGalleryHtml("priest");
  assert(html.includes("mutation-silhouette"), "галерея: силуэты");
  assert((html.match(/mutation-silhouette/g) || []).length >= 8, "галерея: 8 ячеек");
  assert(html.includes("data-mutation-id"), "галерея: id мутации");
  assert(html.includes('type="button"'), "галерея: кликабельные кнопки");
  assert(html.includes("Жрец-мыковичок"), "галерея: подпись класса");
  passed++;

  const quip = s.getMutationLoreQuip("m_chaos");
  assert(quip.includes("умная"), "лор-квип: хаотичный учёный");
  passed++;

  const escaped = s.escapeMutationUiHtml('<script>"&');
  assert(escaped === "&lt;script&gt;&quot;&amp;", "escape html");
  passed++;

  const intent = s.formatMutationIntentLabel("warrior", "w_berserk");
  assert(intent.includes("Воин") && intent.includes("Берсерк"), "intent label: герой + путь");
  passed++;

  const formMeta = s.getPrepMutationBadgeMeta("p_paladin", null, 8);
  assert(formMeta?.kind === "form", "бейдж R8: форма");
  assert(formMeta?.emoji === "⚔️", "бейдж R8: emoji");
  passed++;

  const mutMeta = s.getPrepMutationBadgeMeta("p_paladin", "p_paladin", 16);
  assert(mutMeta?.kind === "mutation", "бейдж R16: мутация");
  passed++;

  const badgeHtml = s.renderLobbyMutationBadgeHtml({ mutationFormId: "p_oracle" }, 10);
  assert(badgeHtml.includes("lobby-mutation-badge--form"), "lobby badge form");
  passed++;

  console.log(`mutation-ui.test.mjs: ${passed}/${passed} OK`);
}

run();
