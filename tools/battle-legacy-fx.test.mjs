/**
 * Legacy horizontal battle FX must stay removed.
 * node tools/battle-legacy-fx.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function loadScripts(sandbox, relPaths) {
  const ctx = vm.createContext(sandbox);
  relPaths.forEach((rel) => {
    const code = fs.readFileSync(path.join(ROOT, rel), "utf8");
    vm.runInContext(code, ctx, { filename: rel });
  });
  return ctx;
}

function testAttackVisualStubs() {
  const state = { attackVisuals: [] };
  const sandbox = {
    console,
    state,
    ITEM_CATALOG: { wooden_sword: { icon: "⚔", tags: ["melee"] } },
    window: null,
  };
  sandbox.window = sandbox;
  loadScripts(sandbox, [
    "components/attack-animation-manager.js",
    "systems/attack-events.js",
  ]);
  sandbox.emitEffectAttackVisual(
    state,
    { uid: "i1", itemId: "wooden_sword" },
    "player",
    { type: "heal" },
    {},
  );
  assert(!state.attackVisuals?.length, "emitEffectAttackVisual must not enqueue attack visuals");
  sandbox.enqueueAttackVisual(state, { id: "atk-1" });
  assert(!state.attackVisuals?.length, "enqueueAttackVisual must be a no-op");
}

function testStackOrbitNoProjectiles() {
  let spawnCalls = 0;
  const sandbox = {
    console,
    performance: { now: () => 1000 },
    document: {
      querySelector: () => null,
      getElementById: () => null,
    },
    floatLayer: {
      spawn(_text, _cls, _x, _y, opts = {}) {
        spawnCalls += 1;
        if (opts.toVx != null || opts.toVy != null) {
          throw new Error("horizontal stack projectile must not spawn");
        }
      },
    },
    BattleFxTier: { isLightBattleFx: () => false, stackOrbitParticlesEnabled: () => true },
    window: null,
  };
  sandbox.window = sandbox;
  loadScripts(sandbox, ["systems/stack-orbit-vfx.js"]);
  sandbox.handleStackOrbitEvent({
    type: "fireStack",
    side: "player",
    stackType: "burn",
    emoji: "🔥",
    count: 3,
  });
  assert(spawnCalls === 0, "fireStack must not launch cross-screen projectiles");
}

function testFloatLayerSourceHasNoHorizontalFly() {
  const src = fs.readFileSync(path.join(ROOT, "battle-float-layer.js"), "utf8");
  assert(!src.includes("toVx"), "battle-float-layer must not support horizontal fly targets");
  assert(!src.includes("spawnEmotionFly"), "spawnEmotionFly must be removed");
}

function testAnimationNoHorizontalArc() {
  const sandbox = {
    console,
    document: { documentElement: { style: {} } },
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    getProfileAvatarViewportCenter: () => ({ x: 200, y: 300 }),
    getProfileAvatarFloatAnchor: () => ({ x: 200, y: 250 }),
    allocateHeroFloatLane: () => 0,
    resolveFloatOriginViewport: () => ({ x: 100, y: 100 }),
    easeOutCubic: (t) => 1 - (1 - t) ** 3,
    window: null,
  };
  sandbox.window = sandbox;
  loadScripts(sandbox, ["systems/animation.js"]);
  const state = { floatingNumbers: [], animations: { pulses: [], flashes: [], failedPopups: [] } };
  sandbox.spawnBattleFloat(state, "−3", "#f85149", {
    sourceTeam: "player",
    kind: "damage",
    trajectory: "weapon",
    spawnAtTarget: false,
  });
  sandbox.tickFloatingNumbers(state, 0.5);
  const fn = state.floatingNumbers[0];
  assert(fn, "floating number should exist");
  assert(Math.abs(fn.x - 200) < 0.01, "float X should stay at hero anchor, not arc horizontally");
  assert(fn.y < 300, "float should rise above hero anchor");
}

function main() {
  testAttackVisualStubs();
  testStackOrbitNoProjectiles();
  testFloatLayerSourceHasNoHorizontalFly();
  testAnimationNoHorizontalArc();
  console.log("battle-legacy-fx.test.mjs: OK");
}

main();
