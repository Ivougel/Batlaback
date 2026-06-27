/**
 * Лёгкие idle-эффекты предметов на экране подготовки (visualEffect из тегов/редкости).
 */

const ItemEffectsController = (() => {
  const RARITY_INTENSITY = {
    common: 0.45,
    rare: 0.6,
    epic: 0.75,
    legendary: 0.9,
    unique: 0.95,
    godly: 1,
  };

  function resolveVisualEffect(def) {
    if (!def) return "default";
    if (def.visualEffect) return def.visualEffect;
    const tags = def.tags || [];
    const effects = def.effects || [];
    if (tags.includes("fire") || effects.some((e) => e.type === "groundFire")) return "fire";
    if (effects.some((e) => e.type === "poison") || tags.includes("poison")) return "poison";
    if (tags.includes("magic") || tags.includes("gem") || tags.includes("wand")) return "magic";
    if (tags.includes("weapon")) return "weapon";
    if (tags.includes("potion") || tags.includes("food")) return "potion";
    if (["legendary", "unique", "godly"].includes(def.rarity)) return "legendary";
    return "default";
  }

  function hashUid(uid, salt = 0) {
    let h = salt;
    for (let i = 0; i < (uid || "").length; i++) h = (h * 31 + uid.charCodeAt(i)) | 0;
    return (h & 0xffff) / 0xffff;
  }

  function intensityFor(def) {
    return RARITY_INTENSITY[def?.rarity] || 0.5;
  }

  function drawFireIdle(ctx, cx, cy, time, uid, intensity) {
    const flicker = 0.5 + Math.sin(time * 8 + hashUid(uid, 1) * 6) * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.25 * intensity * flicker;
    ctx.fillStyle = "#ff6b35";
    ctx.beginPath();
    ctx.arc(cx, cy + 6, 4 + flicker * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = "#ff9500";
    ctx.shadowBlur = 6 * intensity;
    ctx.globalAlpha = 0.35 * intensity;
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(cx - 2, cy + 4, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPoisonIdle(ctx, cx, cy, time, uid, intensity) {
    const bob = Math.sin(time * 3 + hashUid(uid, 2) * 10);
    ctx.save();
    ctx.globalAlpha = 0.22 * intensity;
    ctx.fillStyle = "#3ddc84";
    for (let i = 0; i < 2; i++) {
      const ox = (hashUid(uid, i + 3) - 0.5) * 10;
      const oy = bob * 3 - i * 4;
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, 2 + i * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMagicIdle(ctx, cx, cy, time, uid, intensity) {
    const pulse = 0.5 + Math.sin(time * 2.2 + hashUid(uid, 4) * 8) * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.18 + pulse * 0.12 * intensity;
    ctx.strokeStyle = "#b388ff";
    ctx.lineWidth = 1.2;
    ctx.shadowColor = "#d2a8ff";
    ctx.shadowBlur = 8 * intensity;
    ctx.beginPath();
    ctx.arc(cx, cy, 8 + pulse * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawWeaponIdle(ctx, cx, cy, time, uid, intensity) {
    if (Math.sin(time * 1.5 + hashUid(uid, 5) * 12) < 0.92) return;
    ctx.save();
    ctx.globalAlpha = 0.55 * intensity;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy - 4);
    ctx.lineTo(cx + 4, cy + 3);
    ctx.stroke();
    ctx.restore();
  }

  function drawPotionIdle(ctx, cx, cy, time, uid, intensity) {
    const phase = time * 2.5 + hashUid(uid, 6) * 5;
    ctx.save();
    ctx.globalAlpha = 0.35 * intensity;
    ctx.fillStyle = "rgba(180,240,255,0.8)";
    ctx.beginPath();
    ctx.arc(cx + Math.sin(phase) * 2, cy + 2 + (Math.sin(phase * 1.3) + 1) * 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawLegendaryIdle(ctx, cx, cy, time, uid, intensity) {
    if (Math.sin(time * 0.9 + hashUid(uid, 7) * 20) < 0.75) return;
    ctx.save();
    ctx.globalAlpha = 0.7 * intensity;
    ctx.font = `${uiPx(9)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✦", cx + 7, cy - 7);
    ctx.restore();
  }

  function drawItemIdleEffects(ctx, item, def, team, time, cellRectFn) {
    if (!item || !def || !ctx) return;
    const effect = resolveVisualEffect(def);
    if (effect === "default") return;

    const center = typeof getItemVisualCenter === "function"
      ? getItemVisualCenter(item, team)
      : null;
    if (!center) return;

    const intensity = intensityFor(def);
    switch (effect) {
      case "fire":
        drawFireIdle(ctx, center.x, center.y, time, item.uid, intensity);
        break;
      case "poison":
        drawPoisonIdle(ctx, center.x, center.y, time, item.uid, intensity);
        break;
      case "magic":
        drawMagicIdle(ctx, center.x, center.y, time, item.uid, intensity);
        if (def.rarity === "legendary" || def.rarity === "godly") drawLegendaryIdle(ctx, center.x, center.y, time, item.uid, intensity);
        break;
      case "weapon":
        drawWeaponIdle(ctx, center.x, center.y, time, item.uid, intensity);
        break;
      case "potion":
        drawPotionIdle(ctx, center.x, center.y, time, item.uid, intensity);
        break;
      case "legendary":
        drawLegendaryIdle(ctx, center.x, center.y, time, item.uid, intensity);
        drawMagicIdle(ctx, center.x, center.y, time, item.uid, intensity * 0.5);
        break;
      default:
        break;
    }
  }

  function drawAllPrepItemEffects(ctx, items, team, time) {
    (items || []).forEach((item) => {
      const def = ITEM_CATALOG?.[item.itemId];
      drawItemIdleEffects(ctx, item, def, team, time, cellRect);
    });
  }

  return {
    resolveVisualEffect,
    drawItemIdleEffects,
    drawAllPrepItemEffects,
  };
})();

function drawPrepItemIdleEffects(ctx, item, def, team, time) {
  ItemEffectsController.drawItemIdleEffects(ctx, item, def, team, time, cellRect);
}

function drawAllPrepItemIdleEffects(ctx, items, team, time) {
  ItemEffectsController.drawAllPrepItemEffects(ctx, items, team, time);
}

function resolveItemVisualEffect(def) {
  return ItemEffectsController.resolveVisualEffect(def);
}
