/**
 * DOM hosts for the 4-layer scene compositor.
 */

function getLayerFx() {
  return document.getElementById("layer-fx");
}

function appendToLayerFx(el) {
  const host = getLayerFx();
  (host || document.body).appendChild(el);
  return el;
}
