/**
 * Screen Wake Lock — экран iPad/телефона не гаснет в установленной PWA.
 * Safari iOS 16.4+ (standalone). Повторный запрос после visibilitychange.
 */
(function initPwaWakeLock() {
  /** @type {WakeLockSentinel | null} */
  let sentinel = null;
  let enabled = false;
  let gestureBound = false;

  const GESTURE_TYPES = ["pointerdown", "touchstart", "click", "keydown"];

  function isPwaStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches
      || window.navigator.standalone === true;
  }

  function canUseWakeLock() {
    return "wakeLock" in navigator && typeof navigator.wakeLock.request === "function";
  }

  function unbindGestureUnlock() {
    if (!gestureBound) return;
    gestureBound = false;
    GESTURE_TYPES.forEach((type) => {
      document.removeEventListener(type, onUserGesture, true);
    });
  }

  function bindGestureUnlock() {
    if (gestureBound) return;
    gestureBound = true;
    GESTURE_TYPES.forEach((type) => {
      document.addEventListener(type, onUserGesture, { capture: true, passive: true });
    });
  }

  async function acquireWakeLock() {
    if (!enabled || !canUseWakeLock()) return false;
    if (document.visibilityState !== "visible") return false;
    if (sentinel && !sentinel.released) return true;

    try {
      sentinel = await navigator.wakeLock.request("screen");
      unbindGestureUnlock();
      sentinel.addEventListener("release", () => {
        sentinel = null;
        if (enabled && document.visibilityState === "visible") {
          bindGestureUnlock();
          acquireWakeLock();
        }
      });
      return true;
    } catch (_err) {
      bindGestureUnlock();
      return false;
    }
  }

  function releaseWakeLock() {
    unbindGestureUnlock();
    if (sentinel && !sentinel.released) {
      sentinel.release().catch(() => {});
    }
    sentinel = null;
  }

  function onUserGesture() {
    if (!enabled) return;
    acquireWakeLock();
  }

  function onVisibilityChange() {
    if (!enabled) return;
    if (document.visibilityState === "visible") {
      acquireWakeLock();
    }
  }

  function enable() {
    if (!isPwaStandalone() || !canUseWakeLock()) return false;
    if (enabled) return true;
    enabled = true;
    document.addEventListener("visibilitychange", onVisibilityChange);
    bindGestureUnlock();
    acquireWakeLock();
    return true;
  }

  function disable() {
    if (!enabled) return;
    enabled = false;
    document.removeEventListener("visibilitychange", onVisibilityChange);
    releaseWakeLock();
  }

  window.PwaWakeLock = {
    enable,
    disable,
    acquire: acquireWakeLock,
    release: releaseWakeLock,
    isActive: () => Boolean(sentinel && !sentinel.released),
    isSupported: () => canUseWakeLock(),
    isPwaStandalone,
  };

  if (isPwaStandalone()) {
    window.addEventListener("load", () => enable(), { once: true });
  }
})();
