import type { IntroStepId } from "../types/game";

/**
 * Единая система переходов между экранами: меню → prep → battle → results.
 * Тайминги подобраны под дофаминовые autobattler-петли:
 * частые переходы ≤280ms, наградные моменты до 360ms, выход быстрее входа.
 */
(function initScreenTransitions(): void {
  const INTRO_ORDER: readonly IntroStepId[] = ["mode", "tdDifficulty", "campaignTrial", "player", "companion", "opponent", "summary"];

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
      resultToPrep: 80,
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

  function durationMs(
    bucket: number | Record<string, number | undefined> & { default?: number },
    variant?: string,
  ): number {
    if (reducedMotion) return 0;
    if (typeof bucket === "number") return bucket;
    if (typeof bucket === "object") return bucket[variant ?? "default"] ?? bucket.default ?? 280;
    return 280;
  }

  function wait(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function runGuarded(fn: () => void | Promise<void>): Promise<boolean> {
    if (transitioning) return Promise.resolve(false);
    transitioning = true;
    document.body.classList.add("screen-transitioning");
    return Promise.resolve(fn()).finally(() => {
      transitioning = false;
      document.body.classList.remove("screen-transitioning");
    }).then(() => true);
  }

  function animateElement(el: HTMLElement, className: string, ms: number): Promise<void> {
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
      const onEnd = (e: AnimationEvent) => {
        if (e.target !== el) return;
        finish();
      };
      el.addEventListener("animationend", onEnd);
      window.setTimeout(finish, ms + 40);
    });
  }

  function showScreenOverlay(el: HTMLElement | null, variant = "default"): Promise<void> {
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

  function hideScreenOverlay(el: HTMLElement | null, variant = "default"): Promise<void> {
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

  function getIntroDirection(fromStep: string, toStep: string): "forward" | "back" {
    const fromIdx = INTRO_ORDER.indexOf(fromStep as IntroStepId);
    const toIdx = INTRO_ORDER.indexOf(toStep as IntroStepId);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return "forward";
    return toIdx > fromIdx ? "forward" : "back";
  }

  function pulseIntroStep(overlay: HTMLElement | null, direction: string): Promise<void> {
    if (!overlay) return Promise.resolve();
    const ms = durationMs(TIMING.introEnter);
    if (ms <= 0) return Promise.resolve();
    overlay.dataset.stepAnim = direction;
    return animateElement(overlay.querySelector(".class-modal") || overlay, "intro-step-enter", ms).then(() => {
      delete overlay.dataset.stepAnim;
    });
  }

  function releasePhaseOutLock() {
    document.querySelector(".game-layout")?.classList.remove("phase-transitioning");
  }

  function clearPhaseTransitionLock() {
    releasePhaseOutLock();
    transitioning = false;
    document.body.classList.remove("screen-transitioning");
    window.flushDeferredLayoutPasses?.();
    window.scheduleCanvasFit?.();
  }

  function transitionPhase(
    newPhase: string,
    applyPhase: (phase: string) => void,
    afterTransition?: () => void,
  ): Promise<void> {
    const layout = document.querySelector(".game-layout");
    const outMs = durationMs(TIMING.phaseOut);
    const inMs = durationMs(TIMING.phaseIn);

    if (outMs <= 0) {
      try {
        applyPhase(newPhase);
        afterTransition?.();
      } catch (err) {
        console.error("transitionPhase failed:", err);
        throw err;
      }
      return Promise.resolve();
    }

    if (transitioning) return Promise.resolve();
    transitioning = true;
    document.body.classList.add("screen-transitioning");
    layout?.classList.add("phase-transitioning");

    return wait(outMs).then(() => {
      try {
        applyPhase(newPhase);
        afterTransition?.();
      } catch (err) {
        console.error("transitionPhase failed:", err);
        clearPhaseTransitionLock();
        throw err;
      }
      releasePhaseOutLock();
      return wait(inMs).then(() => {
        clearPhaseTransitionLock();
      });
    });
  }

  /**
   * Итоги → prep: prep собирается под overlay, #app скрыт до конца exit-анимации.
   * Без phase-out pulse и без кадра battle между overlay и prep.
   */
  function transitionFromResultToPrep(
    applyPhase: (phase: string) => void,
    afterTransition?: () => void,
    hideOverlayFn?: () => void,
  ): Promise<void> {
    if (transitioning) return Promise.resolve();

    transitioning = true;
    document.body.classList.add("screen-transitioning", "result-to-prep-transition");

    const overlayDone = typeof hideOverlayFn === "function"
      ? Promise.resolve(hideOverlayFn())
      : Promise.resolve();

    const applyPrepWork = () => new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        try {
          applyPhase("prep");
          afterTransition?.();
          window.applyUiLayout?.();
          window.settlePrepLayoutForReveal?.();
        } catch (err) {
          console.error("result→prep applyPrepWork failed:", err);
        }
        resolve();
      });
    });

    const revealPrep = () => new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        window.settlePrepLayoutForReveal?.();
        requestAnimationFrame(() => {
          transitioning = false;
          document.body.classList.remove("screen-transitioning", "result-to-prep-transition");
          window.flushDeferredLayoutPasses?.();
          resolve();
        });
      });
    });

    return Promise.all([overlayDone, applyPrepWork()]).then(() => revealPrep());
  }

  function crossfadeMenuToGame(onMidpoint?: () => void): Promise<boolean | void> {
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
      window.flushDeferredLayoutPasses?.();
      window.scheduleCanvasFit?.();
    });
  }

  function crossfadeGameToMenu(onMidpoint?: () => void): Promise<boolean | void> {
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
    clearPhaseTransitionLock,
    showScreenOverlay,
    hideScreenOverlay,
    getIntroDirection,
    pulseIntroStep,
    transitionPhase,
    transitionFromResultToPrep,
    crossfadeMenuToGame,
    crossfadeGameToMenu,
  };
})();
