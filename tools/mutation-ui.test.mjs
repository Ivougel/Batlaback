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
  for (const file of ["classes.js", "systems/mutations.js", "systems/mutation-ui.js"]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx);
  }
  vm.runInContext(`
    Object.assign(globalThis, {
      getMutationsForNoviceClass,
      getMutationById,
      getNoviceClassLabel,
      getMutationPerkMeta,
      getMutationGrowthHint,
      getClassIntroBlurb,
      formatMutationMilestoneGap,
      renderMutationProgressHtml,
      formatMutationIntentLabel,
      buildClassMutationGalleryHtml,
      getPrepMutationBadgeMeta,
      renderLobbyMutationBadgeHtml,
      getLobbyFighterMutationEmoji,
      escapeMutationUiHtml,
      MUTATION_ROUND_FORM,
      MUTATION_ROUND_FINAL,
      MUTATION_FORM_THRESHOLD,
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

  const introBlurb = s.getClassIntroBlurb("priest");
  assert(introBlurb.includes("еду") && introBlurb.includes("Старт:"), "class intro blurb: факты");
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

  const sagePerks = s.getMutationPerkMeta("m_sage");
  assert(sagePerks?.capstoneDesc.includes("магическ"), "perk meta: мудрец capstone");
  assert(sagePerks?.formPerk.includes("перезаряжаются"), "perk meta: form perk");
  passed++;

  const zrecrelaGrowth = s.getMutationGrowthHint(s.getMutationById("p_zrecrela"));
  assert(zrecrelaGrowth.includes("святой") && zrecrelaGrowth.includes("музыка"), "growth hint: русские теги");
  passed++;

  const progress = {
    leader: { id: "m_arcanist", name: "АРКАНИСТ", pct: 42 },
    leaderShare: 0.42,
    ranked: [
      { id: "m_arcanist", name: "АРКАНИСТ", pct: 42 },
      { id: "m_sage", name: "МУДРЕЦ", pct: 18 },
    ],
  };
  const htmlProgress = s.renderMutationProgressHtml(progress, null, null, 3, { heroCard: true });
  assert(htmlProgress.includes("mutation-progress-perk"), "progress: perk line");
  assert(htmlProgress.includes("mutation-progress-gap"), "progress: milestone gap");
  assert(htmlProgress.includes('data-mutation-id="m_arcanist"'), "progress: clickable path");
  passed++;

  const gap = s.formatMutationMilestoneGap(progress, 3, null, null);
  assert(gap.includes("Готово к форме"), "milestone gap: готово к R8");
  passed++;

  const mutMetaPerk = s.getPrepMutationBadgeMeta(null, "m_arcanist", 16);
  assert(mutMetaPerk?.perk?.includes("стаков"), "бейдж R16: perk line");
  passed++;

  console.log(`mutation-ui.test.mjs: ${passed}/${passed} OK`);
}

run();
