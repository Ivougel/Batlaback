/**
 * Единая система переходов между экранами: меню → prep → battle → results.
 * Тайминги подобраны под дофаминовые autobattler-петли:
 * частые переходы ≤280ms, наградные моменты до 360ms, выход быстрее входа.
 */
(function () {
  const INTRO_ORDER = ["mode", "player", "companion", "opponent", "summary"];

  const TIMING = {
    introEnter: 240,
    introExit: 160,
    phaseOut: 140,
    phaseIn: 280,
    overlayEnter: {
      default: 280,
      menu: 320,
      result: 300,
      runComplete: 360,
    },
    overlayExit: {
      default: 200,
      menu: 220,
      result: 200,
      runComplete: 260,
    },
  };

  let transitioning = false;
  let reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.addEventListener?.("change", (e) => {
    reducedMotion = e.matches;
  });

  function prefersReducedScreenMotion() {
    return reducedMotion;
  }

  function isScreenTransitioning() {
    return transitioning;
  }

  function durationMs(bucket, variant) {
    if (reducedMotion) return 0;
    if (typeof bucket === "number") return bucket;
    if (typeof bucket === "object") return bucket[variant] ?? bucket.default ?? 280;
    return 280;
  }

  function wait(ms) {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function runGuarded(fn) {
    if (transitioning) return Promise.resolve(false);
    transitioning = true;
    document.body.classList.add("screen-transitioning");
    return Promise.resolve(fn()).finally(() => {
      transitioning = false;
      document.body.classList.remove("screen-transitioning");
    }).then(() => true);
  }

  function animateElement(el, className, ms) {
    if (!el || ms <= 0) return Promise.resolve();
    el.classList.add(className);
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        el.classList.remove(className);
        el.removeEventListener("animationend", onEnd);
        resolve();
      };
      const onEnd = (e) => {
        if (e.target !== el) return;
        finish();
      };
      el.addEventListener("animationend", onEnd);
      window.setTimeout(finish, ms + 40);
    });
  }

  function showScreenOverlay(el, variant = "default") {
    if (!el) return Promise.resolve();
    const ms = durationMs(TIMING.overlayEnter, variant);
    if (ms <= 0) {
      el.classList.remove("hidden");
      el.removeAttribute("aria-hidden");
      return Promise.resolve();
    }
    el.classList.remove("hidden", "overlay-exiting");
    el.removeAttribute("aria-hidden");
    el.dataset.overlayVariant = variant;
    void el.offsetWidth;
    return animateElement(el, "overlay-entering", ms);
  }

  function hideScreenOverlay(el, variant = "default") {
    if (!el) return Promise.resolve();
    const ms = durationMs(TIMING.overlayExit, variant);
    if (ms <= 0 || el.classList.contains("hidden")) {
      el.classList.add("hidden");
      el.setAttribute("aria-hidden", "true");
      el.classList.remove("overlay-entering", "overlay-exiting");
      delete el.dataset.overlayVariant;
      return Promise.resolve();
    }
    el.dataset.overlayVariant = variant;
    return animateElement(el, "overlay-exiting", ms).then(() => {
      el.classList.add("hidden");
      el.setAttribute("aria-hidden", "true");
      el.classList.remove("overlay-exiting");
      delete el.dataset.overlayVariant;
    });
  }

  function getIntroDirection(fromStep, toStep) {
    const fromIdx = INTRO_ORDER.indexOf(fromStep);
    const toIdx = INTRO_ORDER.indexOf(toStep);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return "forward";
    return toIdx > fromIdx ? "forward" : "back";
  }

  function pulseIntroStep(overlay, direction) {
    if (!overlay) return Promise.resolve();
    const ms = durationMs(TIMING.introEnter);
    if (ms <= 0) return Promise.resolve();
    overlay.dataset.stepAnim = direction;
    return animateElement(overlay.querySelector(".class-modal") || overlay, "intro-step-enter", ms).then(() => {
      delete overlay.dataset.stepAnim;
    });
  }

  function transitionPhase(newPhase, applyPhase, afterTransition) {
    const layout = document.querySelector(".game-layout");
    const outMs = durationMs(TIMING.phaseOut);
    const inMs = durationMs(TIMING.phaseIn);

    if (outMs <= 0) {
      applyPhase(newPhase);
      afterTransition?.();
      return Promise.resolve();
    }

    if (transitioning) return Promise.resolve();
    transitioning = true;
    document.body.classList.add("screen-transitioning");
    layout?.classList.add("phase-transitioning");

    return wait(outMs).then(() => {
      applyPhase(newPhase);
      afterTransition?.();
      return wait(0);
    }).then(() => {
      layout?.classList.remove("phase-transitioning");
      transitioning = false;
      document.body.classList.remove("screen-transitioning");
      return wait(inMs);
    });
  }

  function crossfadeMenuToGame(onMidpoint) {
    const overlay = document.getElementById("class-overlay");
    const app = document.getElementById("app");
    const ms = durationMs(TIMING.overlayExit, "menu");

    if (ms <= 0) {
      document.body.classList.add("screen-app-visible");
      overlay?.classList.add("hidden");
      overlay?.setAttribute("aria-hidden", "true");
      onMidpoint?.();
      return Promise.resolve();
    }

    return runGuarded(async () => {
      document.body.classList.add("screen-app-visible");
      if (app) {
        app.style.removeProperty("visibility");
        app.style.removeProperty("pointer-events");
      }
      onMidpoint?.();
      await hideScreenOverlay(overlay, "menu");
    });
  }

  function crossfadeGameToMenu(onMidpoint) {
    const overlay = document.getElementById("class-overlay");

    return runGuarded(async () => {
      document.body.classList.remove("screen-app-visible");
      onMidpoint?.();
      await showScreenOverlay(overlay, "menu");
    });
  }

  window.ScreenTransitions = {
    TIMING,
    INTRO_ORDER,
    prefersReducedScreenMotion,
    isScreenTransitioning,
    showScreenOverlay,
    hideScreenOverlay,
    getIntroDirection,
    pulseIntroStep,
    transitionPhase,
    crossfadeMenuToGame,
    crossfadeGameToMenu,
  };
})();
