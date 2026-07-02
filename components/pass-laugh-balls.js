/**
 * «Купить пропуск» — ржущие смайлики с мягкой физикой резиновых мячиков.
 */
const PassLaughBalls = (() => {
  const EMOJIS = ["😂", "🤣", "😆", "😹", "😁", "🥲", "💀"];
  const MAX_BALLS = 32;
  const SPAWN_BURST = 11;
  const GRAVITY = 860;
  const AIR_DRAG = 0.38;
  const RESTITUTION = 0.76;
  const WALL_RESTITUTION = 0.68;
  const GROUND_FRICTION = 0.84;
  const SPIN_FROM_BOUNCE = 0.028;
  const SPIN_DAMP = 0.985;
  const SETTLE_VY = 36;
  const SETTLE_VX = 10;
  const MAX_AGE = 7.5;
  const FADE_AFTER_SETTLE = 1.35;
  const SUBSTEPS = 3;

  let layerEl = null;
  let balls = [];
  let rafId = 0;
  let lastTs = 0;
  let reducedMotion = false;

  function readUiScale() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--ui-scale").trim();
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  function ensureLayer() {
    if (layerEl) return layerEl;
    layerEl = document.createElement("div");
    layerEl.id = "pass-laugh-layer";
    layerEl.className = "pass-laugh-layer";
    layerEl.setAttribute("aria-hidden", "true");
    document.body.appendChild(layerEl);
    return layerEl;
  }

  function viewportBounds() {
    const vv = window.visualViewport;
    return {
      left: vv?.offsetLeft ?? 0,
      top: vv?.offsetTop ?? 0,
      right: (vv?.offsetLeft ?? 0) + (vv?.width ?? window.innerWidth),
      bottom: (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight),
    };
  }

  function spawnBall(origin, emoji, uiScale) {
    const radius = (18 + Math.random() * 8) * uiScale;
    const angle = -Math.PI * (0.18 + Math.random() * 0.64);
    const speed = (340 + Math.random() * 360) * (0.92 + uiScale * 0.08);
    const el = document.createElement("span");
    el.className = "pass-laugh-ball";
    el.textContent = emoji;
    el.style.fontSize = `${radius * 1.85}px`;
    ensureLayer().appendChild(el);

    return {
      el,
      x: origin.x + (Math.random() - 0.5) * 18 * uiScale,
      y: origin.y + (Math.random() - 0.5) * 8 * uiScale,
      vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 90,
      vy: Math.sin(angle) * speed - 40 - Math.random() * 80,
      radius,
      rotation: (Math.random() - 0.5) * 40,
      omega: (Math.random() - 0.5) * 220,
      squash: 0,
      age: 0,
      settledFor: 0,
      opacity: 0,
      spawnIn: 0.22,
    };
  }

  function stepBall(ball, dt, bounds) {
    ball.age += dt;
    if (ball.spawnIn > 0) {
      ball.spawnIn = Math.max(0, ball.spawnIn - dt);
      ball.opacity = 1 - ball.spawnIn / 0.22;
    } else {
      ball.opacity = 1;
    }

    ball.vy += GRAVITY * dt;
    const drag = Math.exp(-AIR_DRAG * dt);
    ball.vx *= drag;
    ball.vy *= drag;

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.rotation += ball.omega * dt;
    ball.omega *= Math.pow(SPIN_DAMP, dt * 60);
    ball.squash = Math.max(0, ball.squash - dt * 4.8);

    const floor = bounds.bottom - ball.radius * 0.92;
    const ceiling = bounds.top + ball.radius;
    const left = bounds.left + ball.radius;
    const right = bounds.right - ball.radius;

    if (ball.y > floor) {
      ball.y = floor;
      if (Math.abs(ball.vy) > SETTLE_VY) {
        ball.vy = -ball.vy * RESTITUTION;
        ball.vx *= GROUND_FRICTION;
        ball.omega += ball.vx * SPIN_FROM_BOUNCE;
        ball.squash = Math.min(0.28, Math.abs(ball.vy) / 900);
      } else {
        ball.vy = 0;
        ball.vx *= 0.9;
        if (Math.abs(ball.vx) < SETTLE_VX) ball.vx = 0;
      }
    }

    if (ball.y < ceiling) {
      ball.y = ceiling;
      ball.vy = Math.abs(ball.vy) * WALL_RESTITUTION;
    }

    if (ball.x < left) {
      ball.x = left;
      ball.vx = Math.abs(ball.vx) * WALL_RESTITUTION;
      ball.omega -= ball.vx * SPIN_FROM_BOUNCE;
    } else if (ball.x > right) {
      ball.x = right;
      ball.vx = -Math.abs(ball.vx) * WALL_RESTITUTION;
      ball.omega += ball.vx * SPIN_FROM_BOUNCE;
    }

    const onFloor = Math.abs(ball.y - floor) < 1.5;
    const settled = onFloor && Math.abs(ball.vy) < 1 && Math.abs(ball.vx) < SETTLE_VX;
    if (settled) ball.settledFor += dt;
    else ball.settledFor = 0;
  }

  function renderBall(ball) {
    const squashX = 1 + ball.squash;
    const squashY = 1 - ball.squash * 0.55;
    const spawnScale = ball.spawnIn > 0 ? 0.55 + (1 - ball.spawnIn / 0.22) * 0.45 : 1;
    const fade = ball.settledFor > FADE_AFTER_SETTLE
      ? Math.max(0, 1 - (ball.settledFor - FADE_AFTER_SETTLE) / 1.1)
      : ball.age > MAX_AGE
        ? Math.max(0, 1 - (ball.age - MAX_AGE) / 0.9)
        : 1;
    const alpha = ball.opacity * fade;
    ball.el.style.opacity = String(alpha);
    ball.el.style.transform = [
      `translate3d(${(ball.x - ball.radius).toFixed(2)}px, ${(ball.y - ball.radius).toFixed(2)}px, 0)`,
      `rotate(${ball.rotation.toFixed(2)}deg)`,
      `scale(${(squashX * spawnScale).toFixed(3)}, ${(squashY * spawnScale).toFixed(3)})`,
    ].join(" ");
    return alpha;
  }

  function tick(ts) {
    if (!balls.length) {
      rafId = 0;
      lastTs = 0;
      layerEl?.classList.remove("pass-laugh-layer--active");
      return;
    }

    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.032, (ts - lastTs) / 1000);
    lastTs = ts;
    const bounds = viewportBounds();
    const subDt = dt / SUBSTEPS;

    for (let i = balls.length - 1; i >= 0; i -= 1) {
      const ball = balls[i];
      for (let s = 0; s < SUBSTEPS; s += 1) stepBall(ball, subDt, bounds);
      const alpha = renderBall(ball);
      const dead = alpha <= 0.03
        || ball.age > MAX_AGE + 1.2
        || ball.settledFor > FADE_AFTER_SETTLE + 1.15;
      if (dead) {
        ball.el.remove();
        balls.splice(i, 1);
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  function ensureLoop() {
    if (rafId) return;
    lastTs = 0;
    layerEl?.classList.add("pass-laugh-layer--active");
    rafId = requestAnimationFrame(tick);
  }

  function launch(origin = {}) {
    reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    const uiScale = readUiScale();
    const cx = Number.isFinite(origin.x) ? origin.x : window.innerWidth * 0.5;
    const cy = Number.isFinite(origin.y) ? origin.y : window.innerHeight * 0.5;
    const burst = reducedMotion ? 4 : SPAWN_BURST;

    ensureLayer();
    for (let i = 0; i < burst; i += 1) {
      if (balls.length >= MAX_BALLS) {
        const old = balls.shift();
        old?.el?.remove();
      }
      balls.push(spawnBall({ x: cx, y: cy }, EMOJIS[i % EMOJIS.length], uiScale));
    }

    if (typeof playGameSfx === "function") {
      playGameSfx("arc_celebrate");
      window.setTimeout(() => playGameSfx("ui_click"), 90);
    }

    ensureLoop();
  }

  return { launch };
})();

window.launchPassLaughBalls = (origin) => PassLaughBalls.launch(origin);
