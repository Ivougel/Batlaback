/**
 * Canvas HUD боя — чипы урона, аватары, HP/стамина, баффы/дебаффы.
 * Координаты привязаны к PLAYER_X, ENEMY_X, BACKPACK_* и CELL из game.js.
 */

const HUD_AVATAR_R = 38;
const HUD_HP_BAR_W = 200;
const HUD_HP_BAR_H = 10;
const HUD_STAM_BAR_H = 7;
const HUD_EXTRA_H = 168;
const HUD_TOP_GAP = 20;

const STATUS_CHIP_H = 16;
const STATUS_CHIP_FONT = "10px sans-serif";
const STATUS_CHIP_PAD_X = 4;
const STATUS_CHIP_ICON_GAP = 3;
const STATUS_CHIP_GAP = 4;
const STATUS_CHIP_RADIUS = 4;

const STATUS_CHIP_THEMES = {
  block: { fg: "#79c0ff", bg: "rgba(88,166,255,0.15)", border: "rgba(88,166,255,0.45)" },
  poison: { fg: "#ff7b72", bg: "rgba(248,81,73,0.15)", border: "rgba(248,81,73,0.45)" },
  damage: { fg: "#3fb950", bg: "rgba(63,185,80,0.15)", border: "rgba(63,185,80,0.45)" },
  heal: { fg: "#3fb950", bg: "rgba(63,185,80,0.12)", border: "rgba(63,185,80,0.4)" },
  synergy: { fg: "#d2a8ff", bg: "rgba(210,168,255,0.12)", border: "rgba(210,168,255,0.4)" },
};

const HUD_CHIP_COLORS = {
  damage: "#f85149",
  heal: "#3fb950",
  poison: "#56d364",
  block: "#8b949e",
};

const HUD_CHIP_ICON = 13;
const HUD_CHIP_VALUE = 12;
const HUD_CHIP_PAD_X = 7;
const HUD_CHIP_PAD_Y = 3;
const HUD_CHIP_RADIUS = 6;
const HUD_CHIP_GAP = 6;
const HUD_MAX_CHIPS = 3;

let hudRoundAccum = { player: {}, enemy: {} };
let hudLastLogIndex = 0;
const hudCollapseBbox = { player: null, enemy: null };
let hudPopupSide = null;
let hudPopupEl = null;

window.HERO_ANCHOR = {
  AVATAR_R: HUD_AVATAR_R,
  EMOJI_GAP: 30,
  getEmojiOffset(team) {
    return { x: 0, y: 0 };
  },
  getViewportCenter(team) {
    if (typeof getProfileAvatarViewportCenter === "function") {
      const pt = getProfileAvatarViewportCenter(team);
      if (pt?.x != null && pt?.y != null) return pt;
    }
    return hudViewportPoint(team, "avatar");
  },
};

function getBattleHudExtraHeight() {
  return HUD_EXTRA_H;
}

function getCanvasEl() {
  return document.getElementById("game-canvas");
}

function formatVal(n) {
  const abs = Math.abs(n);
  if (abs >= 10000) return (n < 0 ? "−" : "+") + Math.round(abs / 1000) + "к";
  if (abs >= 1000) return (n < 0 ? "−" : "+") + parseFloat((abs / 1000).toFixed(1)) + "к";
  return (n < 0 ? "−" : "+") + Math.round(abs);
}

function chipLabel(entry) {
  return formatVal(Math.round(entry.value));
}

function hudClientToCanvas(clientX, clientY) {
  const canvas = getCanvasEl();
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height),
  };
}

function hudViewportPoint(team, anchor = "avatar") {
  const canvas = getCanvasEl();
  if (!canvas) return { x: 0, y: 0 };
  const layout = getHudLayout(team, canvas.width);
  const y = anchor === "avatar" ? layout.avatarY : layout.chipRowY;
  const rect = canvas.getBoundingClientRect();
  return {
    x: rect.left + (layout.cx / canvas.width) * rect.width,
    y: rect.top + (y / canvas.height) * rect.height,
  };
}

function getHudCx(team, canvasW) {
  const cols = typeof BACKPACK_COLS !== "undefined" ? BACKPACK_COLS : 7;
  const cell = typeof CELL !== "undefined" ? CELL : 50;
  const playerX = typeof PLAYER_X !== "undefined" ? PLAYER_X : 36;
  const enemyX = typeof ENEMY_X !== "undefined" ? ENEMY_X : 0;
  return team === "player"
    ? playerX + (cols * cell) / 2
    : enemyX + (cols * cell) / 2;
}

function getHudYTop() {
  return 380;
}

function getHudLayout(team, canvasW) {
  const yTop = getHudYTop();
  const cx = getHudCx(team, canvasW);
  const avatarY = yTop + HUD_AVATAR_R;
  const hpLabelY = avatarY + HUD_AVATAR_R + 12;
  const hpBarY = hpLabelY + 14;
  const stamBarY = hpBarY + HUD_HP_BAR_H + 10;
  const chipStatusY = stamBarY + HUD_STAM_BAR_H + 8;
  const statusY = stamBarY + HUD_STAM_BAR_H + 18;
  return {
    cx,
    chipRowY: yTop + 10,
    avatarY,
    hpLabelY,
    hpBarY,
    stamBarY,
    chipStatusY,
    statusY,
  };
}

function hpAccentColor(ratio) {
  if (ratio > 0.6) return "#3fb950";
  if (ratio > 0.3) return "#f0c14b";
  return "#f85149";
}

function drawRoundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function findItemMetaByName(name, battleState) {
  if (!name || !battleState) return null;
  const trimmed = String(name).trim();
  for (const t of ["player", "enemy"]) {
    for (const item of battleState[t]?.items || []) {
      const def = typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[item.itemId] : null;
      if (def?.name === trimmed) {
        return { uid: item.uid, itemId: item.itemId, icon: def.icon || "❔", name: def.name };
      }
    }
  }
  return null;
}

function resolveItemMeta(entry, battleState) {
  if (entry.source) {
    const meta = findItemMetaByName(entry.source, battleState);
    if (meta) return meta;
  }
  const msg = entry.message || "";
  const dotMatch = msg.match(/·\s*([^:→]+?)\s*[:→]/);
  if (dotMatch) {
    const meta = findItemMetaByName(dotMatch[1].trim(), battleState);
    if (meta) return meta;
  }
  if (entry.type === "poison" && entry.target) {
    const victim = battleState[entry.target];
    const uid = victim?.poisonSourceItemUid;
    if (uid) {
      const sourceTeam = victim.poisonSourceTeam || (entry.target === "player" ? "enemy" : "player");
      const item = battleState[sourceTeam]?.items?.find((i) => i.uid === uid);
      if (item) {
        const def = ITEM_CATALOG?.[item.itemId];
        return { uid, itemId: item.itemId, icon: def?.icon || "☠", name: def?.name || "Яд" };
      }
    }
  }
  return null;
}

function hudAccumulate(side, meta, type, delta) {
  if (!side || !meta?.uid || !delta) return;
  const store = hudRoundAccum[side];
  if (!store[meta.uid]) {
    store[meta.uid] = { icon: meta.icon, name: meta.name, value: 0, type };
  }
  store[meta.uid].value = Math.round((store[meta.uid].value + delta) * 10) / 10;
}

function parseHudLogEntry(entry, battleState) {
  const msg = entry.message || "";
  if (!msg) return;
  const meta = resolveItemMeta(entry, battleState);
  if (!meta) return;

  if (msg.includes("яд")) {
    const m = msg.match(/[−-](\d+(?:\.\d+)?)\s*HP/i);
    if (m) hudAccumulate(entry.target || entry.actor, meta, "poison", -parseFloat(m[1]));
    return;
  }
  const blockM = msg.match(/\+(\d+(?:\.\d+)?)\s*блок/i);
  if (blockM) {
    hudAccumulate(entry.actor, meta, "block", parseFloat(blockM[1]));
    return;
  }
  const healM = msg.match(/\+(\d+(?:\.\d+)?)\s*HP/i);
  if (healM && (entry.type === "heal" || !msg.includes("→"))) {
    hudAccumulate(entry.actor, meta, "heal", parseFloat(healM[1]));
    return;
  }
  const hpDmgM = msg.match(/HP\s*[−-](\d+(?:\.\d+)?)/i);
  if (hpDmgM) {
    hudAccumulate(entry.target || entry.actor, meta, "damage", -parseFloat(hpDmgM[1]));
    return;
  }
  const dmgM = msg.match(/[−-](\d+(?:\.\d+)?)\s*HP/i);
  if (dmgM && entry.type === "damage") {
    hudAccumulate(entry.target || entry.actor, meta, "damage", -parseFloat(dmgM[1]));
  }
}

function tickHudLog(battleState) {
  const log = battleState?.log;
  if (!Array.isArray(log)) return;
  while (hudLastLogIndex < log.length) {
    const line = log[hudLastLogIndex];
    hudLastLogIndex += 1;
    if (typeof line !== "string") continue;

    const nameMatch = line.match(/^([^:]+):/);
    if (!nameMatch) continue;
    const itemName = nameMatch[1].trim();

    let meta = null;
    for (const t of ["player", "enemy"]) {
      for (const item of battleState[t]?.items || []) {
        const def = typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[item.itemId] : null;
        if (def?.name === itemName) {
          meta = { uid: item.uid, icon: def.icon, name: def.name, team: t };
          break;
        }
      }
      if (meta) break;
    }
    if (!meta) continue;

    const victim = meta.team === "player" ? "enemy" : "player";

    const dmgM = line.match(/[−\-](\d+(?:\.\d+)?)\s*HP/);
    if (dmgM) { hudAccumulate(victim, meta, "damage", -parseFloat(dmgM[1])); continue; }

    const healM = line.match(/\+(\d+(?:\.\d+)?)\s*HP/);
    if (healM) { hudAccumulate(meta.team, meta, "heal", parseFloat(healM[1])); continue; }

    const blockM = line.match(/\+(\d+(?:\.\d+)?)\s*блок/);
    if (blockM) { hudAccumulate(meta.team, meta, "block", parseFloat(blockM[1])); continue; }

    if (line.includes("яд")) { hudAccumulate(victim, meta, "poison", -1); continue; }
  }
}

function measureHudChip(ctx, entry, collapse, hiddenCount) {
  ctx.font = `bold ${HUD_CHIP_VALUE}px sans-serif`;
  const text = collapse ? `+${hiddenCount} ещё ▾` : chipLabel(entry);
  const textW = ctx.measureText(text).width;
  const w = HUD_CHIP_PAD_X * 2 + (collapse ? 0 : HUD_CHIP_ICON + 4) + textW;
  const h = HUD_CHIP_PAD_Y * 2 + Math.max(HUD_CHIP_ICON, HUD_CHIP_VALUE);
  return { w, h, text };
}

function drawHudChip(ctx, cx, cy, entry, opts = {}) {
  const collapse = !!opts.collapse;
  const hiddenCount = opts.hiddenCount || 0;
  const { w, h, text } = measureHudChip(ctx, entry, collapse, hiddenCount);
  const x = cx - w / 2;
  const y = cy - h;

  ctx.save();
  if (collapse) {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    drawRoundRect(ctx, x, y, w, h, HUD_CHIP_RADIUS);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = `bold ${HUD_CHIP_VALUE}px sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#8b949e";
    ctx.fillText(text, x + HUD_CHIP_PAD_X, y + h / 2);
  } else {
    const border = HUD_CHIP_COLORS[entry.type] || HUD_CHIP_COLORS.damage;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    drawRoundRect(ctx, x, y, w, h, HUD_CHIP_RADIUS);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = `${HUD_CHIP_ICON}px sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#e6edf3";
    ctx.fillText(entry.icon || "❔", x + HUD_CHIP_PAD_X, y + h / 2);
    ctx.font = `bold ${HUD_CHIP_VALUE}px sans-serif`;
    ctx.fillStyle = border;
    const textX = x + HUD_CHIP_PAD_X + HUD_CHIP_ICON + 4;
    ctx.fillText(text, textX, y + h / 2);
  }
  ctx.restore();
  return { x, y, w, h };
}

function drawHudChipRow(ctx, team, layout) {
  const entries = Object.values(hudRoundAccum[team] || {}).filter((e) => e.value !== 0);
  if (!entries.length) return null;

  const collapse = entries.length > HUD_MAX_CHIPS;
  const visible = collapse ? entries.slice(0, HUD_MAX_CHIPS) : entries;
  const hidden = collapse ? entries.slice(HUD_MAX_CHIPS) : [];
  const sizes = visible.map((e) => measureHudChip(ctx, e, false, 0));
  const collapseSize = collapse ? measureHudChip(ctx, null, true, hidden.length) : null;
  const gap = HUD_CHIP_GAP;
  const totalW = sizes.reduce((s, m) => s + m.w, 0)
    + (collapse ? collapseSize.w : 0)
    + gap * (visible.length + (collapse ? 1 : 0) - 1);

  let cursorX = layout.cx - totalW / 2;
  const cy = layout.chipRowY;
  visible.forEach((entry, i) => {
    drawHudChip(ctx, cursorX + sizes[i].w / 2, cy, entry);
    cursorX += sizes[i].w + gap;
  });

  if (!collapse) return null;
  const bbox = drawHudChip(ctx, cursorX + collapseSize.w / 2, cy, null, {
    collapse: true,
    hiddenCount: hidden.length,
  });
  bbox.team = team;
  bbox.all = entries;
  return bbox;
}

function drawHudBar(ctx, cx, y, w, h, ratio, color, bg = "rgba(255,255,255,0.08)") {
  const x = cx - w / 2;
  drawRoundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  if (ratio > 0) {
    drawRoundRect(ctx, x, y, Math.max(h, w * ratio), h, h / 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  drawRoundRect(ctx, x, y, w, h, h / 2);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function sumSideRuntime(side, pick) {
  let total = 0;
  for (const item of side?.items || []) {
    total += pick(item.runtime || {});
  }
  return total;
}

function buildStatusChipEntries(side) {
  if (!side) return [];
  const chips = [];

  const block = side.block || 0;
  if (block > 0) {
    chips.push({
      icon: "🛡",
      label: String(Math.round(block)),
      theme: STATUS_CHIP_THEMES.block,
    });
  }

  const poison = side.poisonStacks || 0;
  if (poison > 0) {
    chips.push({
      icon: "☠",
      label: String(Math.round(poison)),
      theme: STATUS_CHIP_THEMES.poison,
    });
  }

  const damageBonus = sumSideRuntime(side, (rt) => (rt.damageBonus || 0) + (rt.pendingAttackBuff || 0));
  if (damageBonus > 0) {
    chips.push({
      icon: "⚔",
      label: String(Math.round(damageBonus)),
      theme: STATUS_CHIP_THEMES.damage,
    });
  }

  const healBonus = sumSideRuntime(side, (rt) => rt.healBonus || 0);
  if (healBonus > 0) {
    chips.push({
      icon: "🌿",
      label: String(Math.round(healBonus)),
      theme: STATUS_CHIP_THEMES.heal,
    });
  }

  const synergyCount = sumSideRuntime(side, (rt) => (rt.activeSynergies || []).length);
  if (synergyCount > 0) {
    chips.push({
      icon: "✦",
      label: String(Math.round(synergyCount)),
      theme: STATUS_CHIP_THEMES.synergy,
    });
  }

  return chips;
}

function measureStatusChip(ctx, icon, label) {
  ctx.font = STATUS_CHIP_FONT;
  const iconW = ctx.measureText(icon).width;
  const labelW = ctx.measureText(label).width;
  const w = STATUS_CHIP_PAD_X * 2 + iconW + STATUS_CHIP_ICON_GAP + labelW;
  return { w, h: STATUS_CHIP_H, iconW, labelW };
}

function drawSingleStatusChip(ctx, x, y, icon, label, theme) {
  const { w, h, iconW } = measureStatusChip(ctx, icon, label);

  ctx.fillStyle = theme.bg;
  drawRoundRect(ctx, x, y, w, h, STATUS_CHIP_RADIUS);
  ctx.fill();
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = STATUS_CHIP_FONT;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = theme.fg;
  ctx.fillText(icon, x + STATUS_CHIP_PAD_X, y + h / 2);
  ctx.fillText(label, x + STATUS_CHIP_PAD_X + iconW + STATUS_CHIP_ICON_GAP, y + h / 2);
  return w;
}

function drawStatusChips(ctx, side, anchorX, anchorY, align) {
  const chips = buildStatusChipEntries(side);
  if (!chips.length) {
    ctx.textBaseline = "alphabetic";
    return;
  }

  ctx.save();
  ctx.font = STATUS_CHIP_FONT;

  const sizes = chips.map((chip) => measureStatusChip(ctx, chip.icon, chip.label));
  const totalW = sizes.reduce((sum, size) => sum + size.w, 0)
    + STATUS_CHIP_GAP * Math.max(0, chips.length - 1);

  let x;
  if (align === "center") {
    x = anchorX - totalW / 2;
  } else if (align === "right") {
    x = anchorX - totalW;
  } else {
    x = anchorX;
  }
  chips.forEach((chip, index) => {
    const w = drawSingleStatusChip(ctx, x, anchorY, chip.icon, chip.label, chip.theme);
    x += w + STATUS_CHIP_GAP;
  });

  ctx.textBaseline = "alphabetic";
  ctx.restore();
}

function drawBattleHudSide(_ctx, _team, _side, _canvasW) {
  // Status chips and HP/stamina bars render in DOM (.avatar-hero-upper / .avatar-hero-effects-panel).
}

function ensureHudPopup() {
  if (hudPopupEl) return hudPopupEl;
  const wrap = getCanvasEl()?.parentElement;
  if (!wrap) return null;
  hudPopupEl = document.createElement("div");
  hudPopupEl.id = "battle-hud-dmg-popup";
  hudPopupEl.hidden = true;
  hudPopupEl.style.cssText = [
    "position:absolute",
    "background:#161b22",
    "border:1px solid #30363d",
    "border-radius:10px",
    "padding:10px 12px",
    "min-width:190px",
    "z-index:50",
    "font-family:sans-serif",
    "pointer-events:auto",
    "display:none",
    "box-shadow:0 8px 24px rgba(0,0,0,0.45)",
  ].join(";");
  wrap.appendChild(hudPopupEl);
  return hudPopupEl;
}

function closeHudPopup() {
  hudPopupSide = null;
  if (hudPopupEl) {
    hudPopupEl.hidden = true;
    hudPopupEl.style.display = "none";
  }
}

function hudTypePx(remSize) {
  if (typeof LayoutScales !== "undefined") return LayoutScales.typePx(remSize);
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return Math.round(root * remSize);
}

function openHudPopup(bbox) {
  const popup = ensureHudPopup();
  if (!popup || !bbox) return;
  const rowFont = hudTypePx(0.8125);
  const iconFont = hudTypePx(1);
  const headerFont = hudTypePx(0.75);
  const rows = (bbox.all || []).map((entry) => {
    const color = HUD_CHIP_COLORS[entry.type] || "#8b949e";
    const val = entry.type === "block"
      ? `+${Math.abs(Math.round(entry.value))}`
      : chipLabel(entry);
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:${rowFont}px">`
      + `<span style="font-size:${iconFont}px;width:20px;text-align:center">${entry.icon || "❔"}</span>`
      + `<span style="flex:1;color:#c9d1d9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${entry.name || "Предмет"}</span>`
      + `<span style="font-weight:700;color:${color}">${val}</span></div>`;
  }).join("");
  popup.innerHTML = `<div style="font-size:${headerFont}px;color:#8b949e;margin-bottom:8px">Все эффекты раунда</div>${rows}`;
  popup.hidden = false;
  popup.style.display = "block";

  const canvas = getCanvasEl();
  const wrap = canvas.parentElement;
  const wrapRect = wrap.getBoundingClientRect();
  const scaleX = canvas.getBoundingClientRect().width / canvas.width;
  const scaleY = canvas.getBoundingClientRect().height / canvas.height;
  let left = (bbox.x + bbox.w / 2) * scaleX - popup.offsetWidth / 2;
  let top = bbox.y * scaleY - popup.offsetHeight - 8;
  left = Math.max(4, Math.min(left, wrapRect.width - popup.offsetWidth - 4));
  top = Math.max(4, top);
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
  hudPopupSide = bbox.team;
}

function hitHudBbox(coords, bbox) {
  return bbox
    && coords.x >= bbox.x && coords.x <= bbox.x + bbox.w
    && coords.y >= bbox.y && coords.y <= bbox.y + bbox.h;
}

function handleBattleHudClick(clientX, clientY) {
  const coords = hudClientToCanvas(clientX, clientY);
  for (const team of ["player", "enemy"]) {
    const bb = hudCollapseBbox[team];
    if (hitHudBbox(coords, bb)) {
      if (hudPopupSide === team) closeHudPopup();
      else openHudPopup(bb);
      return true;
    }
  }
  closeHudPopup();
  return false;
}

function initBattleHud() {
  hudRoundAccum = { player: {}, enemy: {} };
  hudLastLogIndex = 0;
  hudCollapseBbox.player = null;
  hudCollapseBbox.enemy = null;
  closeHudPopup();
}

function closeBattleHudPopups() {
  closeHudPopup();
}

function isMobilePortraitBattleHud() {
  // TODO: implement HTML chip fallback for mobile portrait
  return false;
}

function drawBattleHud(ctx, battleState) {
  if (!ctx || !battleState) return;
  const canvasW = ctx.canvas?.width || getCanvasEl()?.width || 920;

  hudCollapseBbox.player = null;
  hudCollapseBbox.enemy = null;

  drawBattleHudSide(ctx, "player", battleState.player, canvasW);
  drawBattleHudSide(ctx, "enemy", battleState.enemy, canvasW);
}
