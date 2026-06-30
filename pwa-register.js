/**
 * Регистрация Service Worker для PWA / офлайн.
 */
(function registerPwa() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { scope: "./" })
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              console.info("[pwa] Доступно обновление — перезагрузите страницу");
            }
          });
        });
      })
      .catch((err) => console.warn("[pwa] SW register failed", err));
  });
})();
