/**
 * Орбита стаков отключена — оставлены заглушки для совместимости с game.js.
 */

function resetStackOrbitVfx() {
  document.querySelectorAll(".avatar-stack-orbit-ring").forEach((el) => {
    el.replaceChildren();
    el.hidden = true;
    delete el.dataset.orbitSig;
    delete el.dataset.orbitSizeKey;
  });
}

function syncStackOrbitFromBattle() {}

function handleStackOrbitEvent() {}

window.resetStackOrbitVfx = resetStackOrbitVfx;
window.syncStackOrbitFromBattle = syncStackOrbitFromBattle;
window.handleStackOrbitEvent = handleStackOrbitEvent;
