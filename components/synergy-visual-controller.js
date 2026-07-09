/**
 * Усиление визуала синергий на экране подготовки — связи, подсветка, ✨.
 */

const SynergyVisualController = (() => {
  const bursts = [];
  let lastSynergySig = "";

  function synergySignature(list) {
    return (list || [])
      .map((s) => `${s.itemUids?.join("-")}:${s.strength || ""}`)
      .sort()
      .join("|");
  }

  function onSynergiesUpdated(side) {
    const list = side === "enemy"
      ? synergyState.enemyActiveSynergies
      : synergyState.activeSynergies;
    const sig = synergySignature(list);
    if (sig === lastSynergySig) return;

    const prevParts = new Set(lastSynergySig.split("|").filter(Boolean));
    const added = sig.split("|").filter((part) => part && !prevParts.has(part));
    lastSynergySig = sig;

    added.forEach((part) => {
      const syn = (list || []).find((s) => `${s.itemUids?.join("-")}:${s.strength || ""}` === part);
      if (!syn?.itemUids || syn.itemUids.length < 2) return;
      bursts.push({
        uids: [...syn.itemUids],
        t: 0,
        duration: 0.55,
        strong: syn.strength === "strong",
        side,
      });
    });
  }

  function drawConnectionSpark(ctx, from, to, color, pulse, time, strong) {
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const wave = Math.sin(time * 4) * (strong ? 5 : 3);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = strong ? 2.2 : 1.6;
    ctx.shadowColor = color;
    ctx.shadowBlur = strong ? 12 : 8;
    ctx.globalAlpha = 0.35 + pulse * 0.25;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(midX + wave, midY - wave, to.x, to.y);
    ctx.stroke();

    ctx.globalAlpha = 0.55 + pulse * 0.25;
    ctx.font = `${uiPx(strong ? 11 : 9)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(strong ? "✨" : "✦", midX, midY - 2);
    ctx.restore();
  }

  function drawItemSynergyHighlight(ctx, item, team, pulse, strong) {
    const cells = getItemCells(item);
    cells.forEach(([c, r]) => {
      const rect = cellRect(team, c, r);
      ctx.save();
      ctx.strokeStyle = strong ? "rgba(255, 220, 120, 0.55)" : "rgba(140, 200, 255, 0.45)";
      ctx.lineWidth = strong ? 2 : 1.5;
      ctx.shadowColor = strong ? "#ffe066" : "#79c0ff";
      ctx.shadowBlur = 6 + pulse * 4;
      roundRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4, 5);
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawEnhancements(ctx, time, side, items) {
    if (typeof phase !== "undefined" && phase !== "prep") return;
    if (typeof BattleFxTier !== "undefined" && BattleFxTier.prepSynergyFxEnabled
      && !BattleFxTier.prepSynergyFxEnabled()) {
      return;
    }

    const synergies = side === "enemy"
      ? synergyState.enemyActiveSynergies
      : synergyState.activeSynergies;
    if (!synergies?.length || !items?.length) return;

    const pulse = 0.5 + Math.sin(time * 3.2) * 0.5;
    const uidToItem = new Map(items.map((i) => [i.uid, i]));

    synergies.forEach((syn) => {
      const itemA = uidToItem.get(syn.itemUids?.[0]);
      const itemB = uidToItem.get(syn.itemUids?.[1]);
      if (!itemA || !itemB) return;

      const strong = syn.strength === "strong";
      drawItemSynergyHighlight(ctx, itemA, side, pulse, strong);
      drawItemSynergyHighlight(ctx, itemB, side, pulse, strong);

      const centerA = getItemVisualCenter(itemA, side);
      const centerB = getItemVisualCenter(itemB, side);
      const color = strong ? "rgba(255, 210, 90, 0.85)" : "rgba(130, 190, 255, 0.75)";
      drawConnectionSpark(ctx, centerA, centerB, color, pulse, time, strong);
    });

    bursts.forEach((burst) => {
      const p = burst.t / burst.duration;
      if (p >= 1) return;
      const fade = 1 - p;
      burst.uids.forEach((uid) => {
        const item = uidToItem.get(uid);
        if (!item) return;
        const center = getItemVisualCenter(item, side);
        ctx.save();
        ctx.globalAlpha = fade * 0.85;
        ctx.font = `${uiPx(burst.strong ? 14 : 11)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("✨", center.x, center.y - 10 - p * 8);
        ctx.restore();
      });
    });
  }

  function tick(dt) {
    for (let i = bursts.length - 1; i >= 0; i--) {
      bursts[i].t += dt;
      if (bursts[i].t >= bursts[i].duration) bursts.splice(i, 1);
    }
  }

  return {
    onSynergiesUpdated,
    drawEnhancements,
    tick,
  };
})();

function onPrepSynergiesUpdated(side) {
  SynergyVisualController.onSynergiesUpdated(side);
}

function drawPrepSynergyEnhancements(ctx, time, side, items) {
  SynergyVisualController.drawEnhancements(ctx, time, side, items);
}

function tickSynergyVisualController(dt) {
  SynergyVisualController.tick(dt);
}
