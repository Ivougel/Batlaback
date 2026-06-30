/**
 * ArenaAttackStyles — уникальные анимации атак экипировки манекена + реакции боевых эмодзи.
 * Каждый стиль: траектория полёта оружия + thoughtReaction для цели.
 */

const ArenaAttackStyles = (() => {
  function easeOutCubic(t) {
    const u = 1 - t;
    return 1 - u * u * u;
  }

  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function quadBezier(p0, p1, p2, t) {
    const u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    };
  }

  function hashItemId(itemId) {
    let h = 0;
    const s = String(itemId || "");
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function itemParams(itemId) {
    const h = hashItemId(itemId);
    return {
      spin: h % 2 === 0 ? 1 : -1,
      arc: 0.85 + (h % 7) * 0.06,
      wobble: 0.9 + (h % 5) * 0.08,
      hitsBonus: h % 2,
    };
  }

  function arcCtrl(from, to, vmin, liftRatio = 0.14, sideBias = 0) {
    const midX = (from.x + to.x) * 0.5 + sideBias * vmin * 0.04;
    const midY = Math.min(from.y, to.y) - vmin * liftRatio;
    return { x: midX, y: midY };
  }

  function linearPhase(from, to, t, ease = easeOutCubic) {
    const u = ease(Math.min(1, Math.max(0, t)));
    return {
      x: lerp(from.x, to.x, u),
      y: lerp(from.y, to.y, u),
      scale: 1 + u * 0.1,
      rotation: u * 90,
    };
  }

  function bezierPhase(from, to, ctrl, t, ease = easeOutCubic) {
    const u = ease(Math.min(1, Math.max(0, t)));
    const pt = quadBezier(from, to, ctrl, u);
    const angle = Math.atan2(to.y - ctrl.y, to.x - ctrl.x) * (180 / Math.PI);
    return { x: pt.x, y: pt.y, scale: 0.9 + u * 0.22, rotation: angle * 0.35 };
  }

  /** @type {Record<string, object>} */
  const STYLES = {
    slash: {
      id: "slash",
      phases: { windup: 0.12, strike: 0.2, recover: 0.26 },
      hits: () => [2, 4],
      thoughtReaction: { kind: "shake", intensity: 1, duration: 0.34 },
      windup(atk, t, vmin, params) {
        const pull = vmin * 0.018 * params.spin;
        return {
          x: atk.fromX - pull,
          y: atk.fromY + pull * 0.3,
          scale: 1 + t * 0.06,
          rotation: -28 * params.spin * t,
        };
      },
      strike(atk, t, vmin, params) {
        const from = { x: atk.fromX, y: atk.fromY };
        const to = { x: atk.targetX, y: atk.targetY };
        const ctrl = arcCtrl(from, to, vmin, 0.1 * params.arc, params.spin);
        const pt = bezierPhase(from, to, ctrl, t, easeOutCubic);
        pt.rotation += t * 140 * params.spin;
        return pt;
      },
      recover(atk, t, vmin) {
        const homeX = atk.useViewport ? atk.homeVpX : atk.homeX;
        const homeY = atk.useViewport ? atk.homeVpY : atk.homeY;
        const from = { x: atk.strikeX, y: atk.strikeY };
        const to = { x: homeX, y: homeY };
        return linearPhase(from, to, t, easeInOutQuad);
      },
    },

    stab: {
      id: "stab",
      phases: { windup: 0.08, strike: 0.14, recover: 0.2 },
      hits: () => [3, 5],
      thoughtReaction: { kind: "flinch", intensity: 1.1, duration: 0.28 },
      windup(atk, t, vmin, params) {
        const back = vmin * 0.022;
        return {
          x: atk.fromX - back * params.spin,
          y: atk.fromY,
          scale: 0.92 + t * 0.05,
          rotation: -12 * params.spin,
        };
      },
      strike(atk, t, vmin, params) {
        const u = easeOutCubic(t);
        return {
          x: lerp(atk.fromX, atk.targetX, u),
          y: lerp(atk.fromY, atk.targetY, u),
          scale: 1 + u * 0.18,
          rotation: u * 24 * params.spin,
        };
      },
      recover(atk, t) {
        const homeX = atk.useViewport ? atk.homeVpX : atk.homeX;
        const homeY = atk.useViewport ? atk.homeVpY : atk.homeY;
        return linearPhase({ x: atk.strikeX, y: atk.strikeY }, { x: homeX, y: homeY }, t, easeOutCubic);
      },
    },

    smash: {
      id: "smash",
      phases: { windup: 0.2, strike: 0.16, recover: 0.32 },
      hits: () => [1, 2],
      thoughtReaction: { kind: "squash", intensity: 1.3, duration: 0.42 },
      windup(atk, t, vmin, params) {
        const lift = vmin * 0.05 * t;
        return {
          x: atk.fromX,
          y: atk.fromY - lift,
          scale: 1 + t * 0.2,
          rotation: -55 * params.spin * t,
        };
      },
      strike(atk, t, vmin, params) {
        const u = easeOutBack(Math.min(1, t * 1.1));
        const pt = {
          x: lerp(atk.fromX, atk.targetX, u),
          y: lerp(atk.fromY, atk.targetY, u) + Math.sin(u * Math.PI) * vmin * 0.02,
          scale: 1.15 + u * 0.2,
          rotation: 40 * params.spin,
        };
        return pt;
      },
      recover(atk, t) {
        const homeX = atk.useViewport ? atk.homeVpX : atk.homeX;
        const homeY = atk.useViewport ? atk.homeVpY : atk.homeY;
        const pt = linearPhase({ x: atk.strikeX, y: atk.strikeY }, { x: homeX, y: homeY }, t, easeInOutQuad);
        pt.scale = 1.2 - t * 0.2;
        return pt;
      },
    },

    heavy: {
      id: "heavy",
      phases: { windup: 0.22, strike: 0.24, recover: 0.34 },
      hits: () => [1, 2],
      thoughtReaction: { kind: "stagger", intensity: 1.4, duration: 0.48 },
      windup(atk, t, vmin, params) {
        return {
          x: atk.fromX - vmin * 0.03 * params.spin * t,
          y: atk.fromY - vmin * 0.02 * t,
          scale: 1 + t * 0.25,
          rotation: -70 * params.spin * t,
        };
      },
      strike(atk, t, vmin, params) {
        const from = { x: atk.fromX, y: atk.fromY };
        const to = { x: atk.targetX, y: atk.targetY };
        const ctrl = arcCtrl(from, to, vmin, 0.18 * params.arc, params.spin);
        const pt = bezierPhase(from, to, ctrl, t, easeOutCubic);
        pt.scale = 1.1 + t * 0.28;
        pt.rotation += t * 200 * params.spin;
        return pt;
      },
      recover(atk, t) {
        const homeX = atk.useViewport ? atk.homeVpX : atk.homeX;
        const homeY = atk.useViewport ? atk.homeVpY : atk.homeY;
        return linearPhase({ x: atk.strikeX, y: atk.strikeY }, { x: homeX, y: homeY }, t, easeInOutQuad);
      },
    },

    arrow: {
      id: "arrow",
      phases: { windup: 0.1, strike: 0.28, recover: 0.22 },
      hits: () => [2, 3],
      thoughtReaction: { kind: "duck", intensity: 1, duration: 0.32 },
      windup(atk, t, vmin, params) {
        return {
          x: atk.fromX - vmin * 0.012 * params.spin,
          y: atk.fromY + vmin * 0.008,
          scale: 0.88 + t * 0.08,
          rotation: -18 * params.spin,
        };
      },
      strike(atk, t, vmin, params) {
        const from = { x: atk.fromX, y: atk.fromY };
        const to = { x: atk.targetX, y: atk.targetY };
        const ctrl = arcCtrl(from, to, vmin, 0.08, -params.spin);
        const pt = bezierPhase(from, to, ctrl, t, easeOutCubic);
        const angle = Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI);
        pt.rotation = angle;
        pt.scale = 0.95 + t * 0.08;
        return pt;
      },
      recover(atk, t) {
        const homeX = atk.useViewport ? atk.homeVpX : atk.homeX;
        const homeY = atk.useViewport ? atk.homeVpY : atk.homeY;
        return linearPhase({ x: atk.strikeX, y: atk.strikeY }, { x: homeX, y: homeY }, t, easeOutCubic);
      },
    },

    javelin: {
      id: "javelin",
      phases: { windup: 0.12, strike: 0.22, recover: 0.24 },
      hits: () => [2, 3],
      thoughtReaction: { kind: "impale", intensity: 1.15, duration: 0.36 },
      windup(atk, t, vmin, params) {
        return {
          x: atk.fromX,
          y: atk.fromY - vmin * 0.025 * t,
          scale: 1 + t * 0.12,
          rotation: -30 * params.spin * t,
        };
      },
      strike(atk, t, vmin, params) {
        const u = easeOutCubic(t);
        const wobble = Math.sin(t * Math.PI * 3) * vmin * 0.003;
        const angle = Math.atan2(atk.targetY - atk.fromY, atk.targetX - atk.fromX) * (180 / Math.PI);
        return {
          x: lerp(atk.fromX, atk.targetX, u),
          y: lerp(atk.fromY, atk.targetY, u) + wobble,
          scale: 1 + u * 0.14,
          rotation: angle + t * 40 * params.spin,
        };
      },
      recover(atk, t) {
        const homeX = atk.useViewport ? atk.homeVpX : atk.homeX;
        const homeY = atk.useViewport ? atk.homeVpY : atk.homeY;
        return linearPhase({ x: atk.strikeX, y: atk.strikeY }, { x: homeX, y: homeY }, t, easeInOutQuad);
      },
    },

    whip: {
      id: "whip",
      phases: { windup: 0.14, strike: 0.18, recover: 0.26 },
      hits: () => [2, 4],
      thoughtReaction: { kind: "ripple", intensity: 1, duration: 0.38 },
      windup(atk, t, vmin, params) {
        const swing = Math.sin(t * Math.PI) * vmin * 0.03 * params.spin;
        return {
          x: atk.fromX + swing,
          y: atk.fromY - vmin * 0.01 * t,
          scale: 1 + t * 0.08,
          rotation: -90 * params.spin * t,
        };
      },
      strike(atk, t, vmin, params) {
        const from = { x: atk.fromX, y: atk.fromY };
        const to = { x: atk.targetX, y: atk.targetY };
        const ctrl = {
          x: from.x + (to.x - from.x) * 0.35 + vmin * 0.06 * params.spin,
          y: Math.min(from.y, to.y) - vmin * 0.12,
        };
        const pt = bezierPhase(from, to, ctrl, t, easeOutCubic);
        pt.rotation += Math.sin(t * Math.PI * 2) * 35;
        return pt;
      },
      recover(atk, t) {
        const homeX = atk.useViewport ? atk.homeVpX : atk.homeX;
        const homeY = atk.useViewport ? atk.homeVpY : atk.homeY;
        return linearPhase({ x: atk.strikeX, y: atk.strikeY }, { x: homeX, y: homeY }, t, easeInOutQuad);
      },
    },

    arcane: {
      id: "arcane",
      phases: { windup: 0.16, strike: 0.3, recover: 0.28 },
      hits: () => [2, 3],
      thoughtReaction: { kind: "spin", intensity: 1, duration: 0.4 },
      windup(atk, t, vmin, params) {
        const pulse = 1 + Math.sin(t * Math.PI * 4) * 0.05;
        return {
          x: atk.fromX,
          y: atk.fromY - vmin * 0.015 * t,
          scale: 0.85 + t * 0.15 * pulse,
          rotation: t * 120 * params.spin,
        };
      },
      strike(atk, t, vmin, params) {
        const from = { x: atk.fromX, y: atk.fromY };
        const to = { x: atk.targetX, y: atk.targetY };
        const ctrl = arcCtrl(from, to, vmin, 0.2 * params.arc, params.spin);
        const pt = bezierPhase(from, to, ctrl, t, easeOutCubic);
        pt.rotation += t * 220 * params.spin;
        pt.scale = 1 + Math.sin(t * Math.PI) * 0.15;
        return pt;
      },
      recover(atk, t) {
        const homeX = atk.useViewport ? atk.homeVpX : atk.homeX;
        const homeY = atk.useViewport ? atk.homeVpY : atk.homeY;
        const pt = linearPhase({ x: atk.strikeX, y: atk.strikeY }, { x: homeX, y: homeY }, t, easeInOutQuad);
        pt.rotation *= 1 - t;
        return pt;
      },
    },

    fireball: {
      id: "fireball",
      phases: { windup: 0.14, strike: 0.32, recover: 0.26 },
      hits: () => [1, 2],
      thoughtReaction: { kind: "burn", intensity: 1.2, duration: 0.45 },
      windup(atk, t, vmin) {
        return {
          x: atk.fromX,
          y: atk.fromY - vmin * 0.02 * t,
          scale: 0.7 + t * 0.35,
          rotation: t * 60,
        };
      },
      strike(atk, t, vmin) {
        const from = { x: atk.fromX, y: atk.fromY };
        const to = { x: atk.targetX, y: atk.targetY };
        const ctrl = arcCtrl(from, to, vmin, 0.16);
        const pt = bezierPhase(from, to, ctrl, t, easeOutCubic);
        pt.scale = 0.9 + Math.sin(t * Math.PI) * 0.35;
        pt.rotation += t * 180;
        return pt;
      },
      recover(atk, t) {
        const homeX = atk.useViewport ? atk.homeVpX : atk.homeX;
        const homeY = atk.useViewport ? atk.homeVpY : atk.homeY;
        return linearPhase({ x: atk.strikeX, y: atk.strikeY }, { x: homeX, y: homeY }, t, easeOutCubic);
      },
    },

    flameSlash: {
      id: "flameSlash",
      phases: { windup: 0.1, strike: 0.18, recover: 0.24 },
      hits: () => [2, 4],
      thoughtReaction: { kind: "burn", intensity: 0.9, duration: 0.36 },
      windup(atk, t, vmin, params) {
        return {
          x: atk.fromX - vmin * 0.015 * params.spin,
          y: atk.fromY,
          scale: 1 + t * 0.1,
          rotation: -20 * params.spin + t * 40,
        };
      },
      strike(atk, t, vmin, params) {
        const u = easeOutCubic(t);
        const trail = Math.sin(u * Math.PI * 2) * vmin * 0.004;
        return {
          x: lerp(atk.fromX, atk.targetX, u),
          y: lerp(atk.fromY, atk.targetY, u) + trail,
          scale: 1 + u * 0.2,
          rotation: u * 160 * params.spin,
        };
      },
      recover(atk, t) {
        const homeX = atk.useViewport ? atk.homeVpX : atk.homeX;
        const homeY = atk.useViewport ? atk.homeVpY : atk.homeY;
        return linearPhase({ x: atk.strikeX, y: atk.strikeY }, { x: homeX, y: homeY }, t, easeInOutQuad);
      },
    },

    ice: {
      id: "ice",
      phases: { windup: 0.12, strike: 0.26, recover: 0.28 },
      hits: () => [2, 3],
      thoughtReaction: { kind: "freeze", intensity: 1, duration: 0.5 },
      windup(atk, t, vmin, params) {
        return {
          x: atk.fromX,
          y: atk.fromY + vmin * 0.008 * t,
          scale: 0.9 + t * 0.08,
          rotation: -t * 45 * params.spin,
        };
      },
      strike(atk, t, vmin, params) {
        const from = { x: atk.fromX, y: atk.fromY };
        const to = { x: atk.targetX, y: atk.targetY };
        const u = easeOutCubic(t);
        const shard = Math.sin(u * Math.PI * 5) * vmin * 0.002;
        return {
          x: lerp(from.x, to.x, u) + shard,
          y: lerp(from.y, to.y, u) - Math.sin(u * Math.PI) * vmin * 0.02,
          scale: 0.95 + u * 0.12,
          rotation: u * 90 * params.spin,
        };
      },
      recover(atk, t) {
        const homeX = atk.useViewport ? atk.homeVpX : atk.homeX;
        const homeY = atk.useViewport ? atk.homeVpY : atk.homeY;
        return linearPhase({ x: atk.strikeX, y: atk.strikeY }, { x: homeX, y: homeY }, t, easeInOutQuad);
      },
    },

    holy: {
      id: "holy",
      phases: { windup: 0.14, strike: 0.24, recover: 0.3 },
      hits: () => [2, 3],
      thoughtReaction: { kind: "dazzle", intensity: 1.1, duration: 0.42 },
      windup(atk, t, vmin) {
        return {
          x: atk.fromX,
          y: atk.fromY - vmin * 0.025 * t,
          scale: 1 + t * 0.15,
          rotation: t * 30,
        };
      },
      strike(atk, t, vmin) {
        const u = easeOutCubic(t);
        return {
          x: lerp(atk.fromX, atk.targetX, u),
          y: lerp(atk.fromY, atk.targetY, u) - Math.sin(u * Math.PI) * vmin * 0.03,
          scale: 1 + Math.sin(u * Math.PI) * 0.2,
          rotation: u * 45,
        };
      },
      recover(atk, t) {
        const homeX = atk.useViewport ? atk.homeVpX : atk.homeX;
        const homeY = atk.useViewport ? atk.homeVpY : atk.homeY;
        return linearPhase({ x: atk.strikeX, y: atk.strikeY }, { x: homeX, y: homeY }, t, easeInOutQuad);
      },
    },

    poison: {
      id: "poison",
      phases: { windup: 0.1, strike: 0.22, recover: 0.26 },
      hits: () => [2, 4],
      thoughtReaction: { kind: "poison", intensity: 1, duration: 0.48 },
      windup(atk, t, vmin, params) {
        return {
          x: atk.fromX + Math.sin(t * Math.PI * 3) * vmin * 0.004,
          y: atk.fromY,
          scale: 0.92 + t * 0.06,
          rotation: t * 25 * params.spin,
        };
      },
      strike(atk, t, vmin, params) {
        const from = { x: atk.fromX, y: atk.fromY };
        const to = { x: atk.targetX, y: atk.targetY };
        const ctrl = arcCtrl(from, to, vmin, 0.06, params.spin);
        const pt = bezierPhase(from, to, ctrl, t, easeOutCubic);
        pt.rotation += Math.sin(t * Math.PI * 4) * 20;
        return pt;
      },
      recover(atk, t) {
        const homeX = atk.useViewport ? atk.homeVpX : atk.homeX;
        const homeY = atk.useViewport ? atk.homeVpY : atk.homeY;
        return linearPhase({ x: atk.strikeX, y: atk.strikeY }, { x: homeX, y: homeY }, t, easeOutCubic);
      },
    },

    poisonCloud: {
      id: "poisonCloud",
      phases: { windup: 0.18, strike: 0.34, recover: 0.3 },
      hits: () => [1, 2],
      thoughtReaction: { kind: "poison", intensity: 1.3, duration: 0.55 },
      windup(atk, t, vmin) {
        return {
          x: atk.fromX,
          y: atk.fromY - vmin * 0.02 * t,
          scale: 0.75 + t * 0.4,
          rotation: t * 90,
        };
      },
      strike(atk, t, vmin) {
        const from = { x: atk.fromX, y: atk.fromY };
        const to = { x: atk.targetX, y: atk.targetY };
        const u = easeInOutQuad(t);
        const spread = Math.sin(u * Math.PI) * vmin * 0.04;
        return {
          x: lerp(from.x, to.x, u) + spread,
          y: lerp(from.y, to.y, u),
          scale: 0.8 + Math.sin(u * Math.PI) * 0.5,
          rotation: u * 120,
        };
      },
      recover(atk, t) {
        const homeX = atk.useViewport ? atk.homeVpX : atk.homeX;
        const homeY = atk.useViewport ? atk.homeVpY : atk.homeY;
        return linearPhase({ x: atk.strikeX, y: atk.strikeY }, { x: homeX, y: homeY }, t, easeInOutQuad);
      },
    },

    drain: {
      id: "drain",
      phases: { windup: 0.14, strike: 0.28, recover: 0.3 },
      hits: () => [2, 3],
      thoughtReaction: { kind: "drain", intensity: 1.15, duration: 0.46 },
      windup(atk, t, vmin, params) {
        return {
          x: atk.fromX + vmin * 0.01 * t * params.spin,
          y: atk.fromY,
          scale: 1 + t * 0.08,
          rotation: t * 50 * params.spin,
        };
      },
      strike(atk, t, vmin, params) {
        const u = easeInOutQuad(t);
        const pull = Math.sin(u * Math.PI) * vmin * 0.015;
        return {
          x: lerp(atk.fromX, atk.targetX, u) - pull * params.spin,
          y: lerp(atk.fromY, atk.targetY, u),
          scale: 1 + Math.sin(u * Math.PI) * 0.15,
          rotation: u * 100 * params.spin,
        };
      },
      recover(atk, t) {
        const homeX = atk.useViewport ? atk.homeVpX : atk.homeX;
        const homeY = atk.useViewport ? atk.homeVpY : atk.homeY;
        return linearPhase({ x: atk.strikeX, y: atk.strikeY }, { x: homeX, y: homeY }, t, easeOutCubic);
      },
    },

    energy: {
      id: "energy",
      phases: { windup: 0.1, strike: 0.2, recover: 0.24 },
      hits: () => [2, 4],
      thoughtReaction: { kind: "spark", intensity: 1, duration: 0.35 },
      windup(atk, t, vmin, params) {
        return {
          x: atk.fromX,
          y: atk.fromY,
          scale: 0.9 + t * 0.12,
          rotation: -t * 35 * params.spin,
        };
      },
      strike(atk, t, vmin, params) {
        const u = easeOutCubic(t);
        const buzz = Math.sin(u * Math.PI * 8) * vmin * 0.002;
        return {
          x: lerp(atk.fromX, atk.targetX, u) + buzz,
          y: lerp(atk.fromY, atk.targetY, u) - buzz,
          scale: 1 + u * 0.16,
          rotation: u * 130 * params.spin,
        };
      },
      recover(atk, t) {
        const homeX = atk.useViewport ? atk.homeVpX : atk.homeX;
        const homeY = atk.useViewport ? atk.homeVpY : atk.homeY;
        return linearPhase({ x: atk.strikeX, y: atk.strikeY }, { x: homeX, y: homeY }, t, easeInOutQuad);
      },
    },

    reap: {
      id: "reap",
      phases: { windup: 0.16, strike: 0.22, recover: 0.3 },
      hits: () => [1, 2],
      thoughtReaction: { kind: "stun", intensity: 1.2, duration: 0.5 },
      windup(atk, t, vmin, params) {
        const sweep = Math.sin(t * Math.PI * 0.5) * vmin * 0.04 * params.spin;
        return {
          x: atk.fromX + sweep,
          y: atk.fromY - vmin * 0.02 * t,
          scale: 1 + t * 0.18,
          rotation: -110 * params.spin * t,
        };
      },
      strike(atk, t, vmin, params) {
        const from = { x: atk.fromX, y: atk.fromY };
        const to = { x: atk.targetX, y: atk.targetY };
        const ctrl = arcCtrl(from, to, vmin, 0.14, -params.spin);
        const pt = bezierPhase(from, to, ctrl, t, easeOutCubic);
        pt.rotation += t * 250 * params.spin;
        return pt;
      },
      recover(atk, t) {
        const homeX = atk.useViewport ? atk.homeVpX : atk.homeX;
        const homeY = atk.useViewport ? atk.homeVpY : atk.homeY;
        return linearPhase({ x: atk.strikeX, y: atk.strikeY }, { x: homeX, y: homeY }, t, easeInOutQuad);
      },
    },

    sweep: {
      id: "sweep",
      phases: { windup: 0.12, strike: 0.2, recover: 0.26 },
      hits: () => [2, 3],
      thoughtReaction: { kind: "stagger", intensity: 0.85, duration: 0.38 },
      windup(atk, t, vmin, params) {
        return {
          x: atk.fromX - vmin * 0.025 * params.spin * t,
          y: atk.fromY,
          scale: 1 + t * 0.05,
          rotation: 60 * params.spin * t,
        };
      },
      strike(atk, t, vmin, params) {
        const from = { x: atk.fromX, y: atk.fromY };
        const to = { x: atk.targetX, y: atk.targetY };
        const ctrl = {
          x: (from.x + to.x) * 0.5,
          y: from.y - vmin * 0.06,
        };
        const pt = bezierPhase(from, to, ctrl, t, easeOutCubic);
        pt.rotation += 180 * params.spin * t;
        return pt;
      },
      recover(atk, t) {
        const homeX = atk.useViewport ? atk.homeVpX : atk.homeX;
        const homeY = atk.useViewport ? atk.homeVpY : atk.homeY;
        return linearPhase({ x: atk.strikeX, y: atk.strikeY }, { x: homeX, y: homeY }, t, easeInOutQuad);
      },
    },

    thrust: {
      id: "thrust",
      phases: { windup: 0.1, strike: 0.2, recover: 0.24 },
      hits: () => [2, 3],
      thoughtReaction: { kind: "impale", intensity: 1, duration: 0.34 },
      windup(atk, t, vmin, params) {
        return {
          x: atk.fromX - vmin * 0.028 * params.spin * t,
          y: atk.fromY + vmin * 0.006 * t,
          scale: 1 + t * 0.08,
          rotation: -8 * params.spin,
        };
      },
      strike(atk, t, vmin, params) {
        const u = easeOutCubic(t);
        return {
          x: lerp(atk.fromX, atk.targetX, u),
          y: lerp(atk.fromY, atk.targetY, u),
          scale: 1 + u * 0.14,
          rotation: u * 18 * params.spin,
        };
      },
      recover(atk, t) {
        const homeX = atk.useViewport ? atk.homeVpX : atk.homeX;
        const homeY = atk.useViewport ? atk.homeVpY : atk.homeY;
        return linearPhase({ x: atk.strikeX, y: atk.strikeY }, { x: homeX, y: homeY }, t, easeOutCubic);
      },
    },

    shadow: {
      id: "shadow",
      phases: { windup: 0.08, strike: 0.16, recover: 0.22 },
      hits: () => [3, 5],
      thoughtReaction: { kind: "flicker", intensity: 1, duration: 0.36 },
      windup(atk, t, vmin, params) {
        const flicker = (Math.random() - 0.5) * vmin * 0.006 * t;
        return {
          x: atk.fromX + flicker,
          y: atk.fromY + flicker,
          scale: 0.85 + t * 0.1,
          rotation: t * 20 * params.spin,
          opacity: 0.7 + t * 0.3,
        };
      },
      strike(atk, t, vmin, params) {
        const u = easeOutCubic(t);
        const jitter = Math.sin(u * Math.PI * 6) * vmin * 0.003;
        return {
          x: lerp(atk.fromX, atk.targetX, u) + jitter,
          y: lerp(atk.fromY, atk.targetY, u) - jitter,
          scale: 1 + u * 0.12,
          rotation: u * 70 * params.spin,
          opacity: 1,
        };
      },
      recover(atk, t) {
        const homeX = atk.useViewport ? atk.homeVpX : atk.homeX;
        const homeY = atk.useViewport ? atk.homeVpY : atk.homeY;
        const pt = linearPhase({ x: atk.strikeX, y: atk.strikeY }, { x: homeX, y: homeY }, t, easeOutCubic);
        pt.opacity = 1 - t * 0.15;
        return pt;
      },
    },

    bash: {
      id: "bash",
      phases: { windup: 0.15, strike: 0.14, recover: 0.28 },
      hits: () => [1, 2],
      thoughtReaction: { kind: "stun", intensity: 1.35, duration: 0.52 },
      windup(atk, t, vmin, params) {
        return {
          x: atk.fromX,
          y: atk.fromY - vmin * 0.035 * t,
          scale: 1 + t * 0.15,
          rotation: -40 * params.spin * t,
        };
      },
      strike(atk, t, vmin, params) {
        const u = easeOutBack(t);
        return {
          x: lerp(atk.fromX, atk.targetX, u),
          y: lerp(atk.fromY, atk.targetY, u),
          scale: 1.2 + u * 0.1,
          rotation: 25 * params.spin,
        };
      },
      recover(atk, t) {
        const homeX = atk.useViewport ? atk.homeVpX : atk.homeX;
        const homeY = atk.useViewport ? atk.homeVpY : atk.homeY;
        return linearPhase({ x: atk.strikeX, y: atk.strikeY }, { x: homeX, y: homeY }, t, easeInOutQuad);
      },
    },
  };

  /** Явная привязка предметов к стилю (уникальная анимация на каждый тип оружия). */
  const BY_ITEM = {
    wooden_sword: "slash",
    hero_sword: "slash",
    villain_sword: "slash",
    axe: "slash",
    katana: "energy",
    pan: "smash",
    hammer: "smash",
    broom: "sweep",
    spear: "thrust",
    poison_spear: "poison",
    holy_spear: "holy",
    molten_spear: "flameSlash",
    fancy_fencing_rapier: "stab",
    bloody_dagger: "stab",
    cursed_dagger: "shadow",
    molten_dagger: "flameSlash",
    shortbow: "arrow",
    bow_and_arrow: "arrow",
    piercing_arrow: "javelin",
    belladonnas_shade: "poison",
    belladonnas_whisper: "poisonCloud",
    fortunas_hope: "arrow",
    fortunas_grace: "arrow",
    thorn_whip: "whip",
    flame_whip: "whip",
    ripsaw_blade: "whip",
    magic_staff: "arcane",
    staff_of_fire: "fireball",
    staff_of_unhealing: "drain",
    serpent_staff: "poisonCloud",
    critwood_staff: "arcane",
    snow_stick: "ice",
    frostbite: "ice",
    lightsaber: "energy",
    darksaber: "shadow",
    prismatic_sword: "energy",
    burning_sword: "flameSlash",
    burning_blade: "flameSlash",
    molten_greatsword: "heavy",
    impractically_large_greatsword: "heavy",
    hungry_blade: "drain",
    bloodthorne: "drain",
    death_scythe: "reap",
    pandamonium: "reap",
    tusk_poker: "javelin",
    tusk_piercer: "javelin",
    friendly_fire: "fireball",
  };

  function hasTag(def, tag) {
    return (def?.tags || []).includes(tag);
  }

  function resolveByTags(def) {
    if (!def) return "slash";
    const tags = def.tags || [];
    if (tags.includes("stun")) return "bash";
    if (def.id?.includes("whip") || tags.includes("spikes") && tags.includes("melee")) return "whip";
    if (def.id?.includes("scythe") || def.icon?.includes("⚰")) return "reap";
    if (def.id?.includes("spear") || def.icon?.includes("🔱")) return tags.includes("poison") ? "poison" : tags.includes("holy") ? "holy" : "thrust";
    if (def.id?.includes("dagger") || def.id?.includes("rapier")) return tags.includes("dark") ? "shadow" : "stab";
    if (def.id?.includes("greatsword") || def.shape?.length > 4) return "heavy";
    if (tags.includes("fire") && tags.includes("magic")) return "fireball";
    if (tags.includes("fire")) return "flameSlash";
    if (tags.includes("cold")) return "ice";
    if (tags.includes("holy")) return "holy";
    if (tags.includes("poison") && tags.includes("magic")) return "poisonCloud";
    if (tags.includes("poison")) return "poison";
    if (tags.includes("vampiric")) return "drain";
    if (tags.includes("magic")) return "arcane";
    if (tags.includes("debuff") && tags.includes("melee")) return "sweep";
    if (tags.includes("dark")) return "shadow";
    if (tags.includes("ranged")) return tags.includes("spikes") ? "javelin" : "arrow";
    if (tags.includes("melee")) return def.id?.includes("hammer") || def.icon?.includes("🔨") ? "smash" : "slash";
    return "slash";
  }

  function resolveStyle(def) {
    if (!def) return STYLES.slash;
    if (def.arenaAttackStyle && STYLES[def.arenaAttackStyle]) return STYLES[def.arenaAttackStyle];
    const key = BY_ITEM[def.id] || resolveByTags(def);
    return STYLES[key] || STYLES.slash;
  }

  function resolveStyleId(def) {
    return resolveStyle(def).id;
  }

  function rollHits(style, itemId) {
    const params = itemParams(itemId);
    const range = style.hits();
    const min = range[0];
    const max = range[1];
    const bonus = params.hitsBonus && Math.random() > 0.5 ? 1 : 0;
    return min + Math.floor(Math.random() * (max - min + 1)) + bonus;
  }

  function createAttack(body, atkBase) {
    const style = STYLES[atkBase.styleId] || STYLES.slash;
    const params = itemParams(body.itemId);
    return {
      ...atkBase,
      styleId: style.id,
      styleParams: params,
      phase: "windup",
      phaseT: 0,
      hitsTotal: rollHits(style, body.itemId),
      hitsDone: 0,
      hitReacted: false,
      homeX: body.homeX,
      homeY: body.homeY,
    };
  }

  function fireThoughtReaction(body, style) {
    if (!style?.thoughtReaction) return;
    if (typeof ThoughtArena === "undefined" || !ThoughtArena.triggerEquipHitReaction) return;
    const victimSide = body.side === "player" ? "enemy" : "player";
    ThoughtArena.triggerEquipHitReaction(victimSide, {
      ...style.thoughtReaction,
      fromSide: body.side,
      styleId: style.id,
      itemId: body.itemId,
    });
  }

  function stepAttack(body, atk, dt, vmin) {
    const style = STYLES[atk.styleId] || STYLES.slash;
    const params = atk.styleParams || itemParams(body.itemId);
    const phases = style.phases;
    const dur = phases[atk.phase] || 0.2;

    atk.phaseT += dt;
    const t = atk.phaseT / dur;

    let visual;
    if (atk.phase === "windup") {
      visual = style.windup(atk, t, vmin, params);
    } else if (atk.phase === "strike") {
      visual = style.strike(atk, t, vmin, params);
      if (t >= 0.55 && !atk.hitReacted) {
        atk.hitReacted = true;
        fireThoughtReaction(body, style);
      }
    } else if (atk.phase === "recover") {
      visual = style.recover(atk, t, vmin, params);
    } else {
      visual = { x: body.renderX, y: body.renderY, scale: 1, rotation: body.rotation || 0 };
    }

    if (visual) {
      body.renderX = visual.x;
      body.renderY = visual.y;
      body.displayScale = visual.scale ?? 1;
      if (visual.rotation != null) body.rotation = visual.rotation;
      if (visual.opacity != null) body.opacity = visual.opacity;
    }

    if (atk.phaseT < dur) return false;

    atk.phaseT = 0;
    atk.hitReacted = false;

    if (atk.phase === "windup") {
      atk.phase = "strike";
      atk.fromX = body.renderX;
      atk.fromY = body.renderY;
      return false;
    }

    if (atk.phase === "strike") {
      atk.strikeX = body.renderX;
      atk.strikeY = body.renderY;
      atk.hitsDone += 1;
      if (atk.hitsDone >= atk.hitsTotal) {
        atk.phase = "recover";
        atk.fromX = atk.strikeX;
        atk.fromY = atk.strikeY;
      } else {
        atk.phase = "windup";
        atk.fromX = atk.strikeX;
        atk.fromY = atk.strikeY;
      }
      return false;
    }

    if (atk.phase === "recover") {
      body.x = atk.useViewport ? atk.homeVpX : body.homeX;
      body.y = atk.useViewport ? atk.homeVpY : body.homeY;
      body.renderX = body.x;
      body.renderY = body.y;
      body.displayScale = 1;
      body.opacity = 1;
      return true;
    }

    return false;
  }

  return {
    STYLES,
    BY_ITEM,
    resolveStyle,
    resolveStyleId,
    createAttack,
    stepAttack,
    itemParams,
  };
})();
