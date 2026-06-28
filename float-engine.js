/**
 * Чипы суммарного урона/эффектов за раунд над HP-барами (canvas + DOM-попап).
 */

let roundDamageAccum = { player: {}, enemy: {} };
let lastLogIndex = 0;
const collapseBboxes = { player: null, enemy: null };
let popupOpenSide = null;
let dmgPopupEl = null;

const CHIP_TYPE_COLORS = {
  damage: "#f85149",
  heal: "#3fb950",
  poison: "#56d364",
  block: "#8b949e",
};

const CHIP_ICON_SIZE = 14;
const CHIP_VALUE_SIZE = 13;
const CHIP_GAP = 4;
const CHIP_PAD_X = 7;
const CHIP_PAD_Y = 3;
const CHIP_RADIUS = 6;
const CHIP_ROW_GAP = 6;
const MAX_VISIBLE_CHIPS = 4;

function resetRoundDamage() {
  roundDamageAccum = { player: {}, enemy: {} };
  lastLogIndex = 0;
  collapseBboxes.player = null;
  collapseBboxes.enemy = null;
  closeDmgPopup();
}

function closeDmgPopup() {
  popupOpenSide = null;
  if (dmgPopupEl) {
    dmgPopupEl.hidden = true;
    dmgPopupEl.style.display = "none";
  }
}

function formatDmgVal(n) {
  const abs = Math.abs(n);
  if (abs >= 10000) return (n < 0 ? "−" : "+") + Math.round(abs / 1000) + "к";
  if (abs >= 1000) return (n < 0 ? "−" : "+") + (abs / 1000).toFixed(1).replace(".0", "") + "к";
  return (n < 0 ? "−" : "+") + abs;
}

function getCanvasEl() {
  return document.getElementById("game-canvas");
}

function clientToCanvas(clientX, clientY) {
  const canvas = getCanvasEl();
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height),
  };
}

function findItemMetaByName(name, battleState) {
  if (!name || !battleState) return null;
  const trimmed = String(name).trim();
  for (const team of ["player", "enemy"]) {
    const items = battleState[team]?.items || [];
    for (const item of items) {
      const def = typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[item.itemId] : null;
      if (def?.name === trimmed) {
        return {
          uid: item.uid,
          itemId: item.itemId,
          icon: def.icon || "❔",
          name: def.name,
        };
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
        return {
          uid: item.uid,
          itemId: item.itemId,
          icon: def?.icon || "☠",
          name: def?.name || "Яд",
        };
      }
    }
  }

  return null;
}

function accumulateEffect(side, meta, type, delta) {
  if (!side || !meta?.uid || !delta) return;
  const store = roundDamageAccum[side];
  if (!store[meta.uid]) {
    store[meta.uid] = {
      itemId: meta.itemId,
      icon: meta.icon,
      name: meta.name,
      value: 0,
      type,
    };
  }
  store[meta.uid].value = Math.round((store[meta.uid].value + delta) * 10) / 10;
}

function parseLogEntry(entry, battleState) {
  const msg = entry.message || "";
  if (!msg) return;

  const meta = resolveItemMeta(entry, battleState);
  if (!meta) return;

  if (msg.includes("яд")) {
    const m = msg.match(/[−-](\d+(?:\.\d+)?)\s*HP/i);
    if (m) {
      const side = entry.target || entry.actor;
      accumulateEffect(side, meta, "poison", -parseFloat(m[1]));
    }
    return;
  }

  const blockM = msg.match(/\+(\d+(?:\.\d+)?)\s*блок/i);
  if (blockM) {
    accumulateEffect(entry.actor, meta, "block", parseFloat(blockM[1]));
    return;
  }

  const healM = msg.match(/\+(\d+(?:\.\d+)?)\s*HP/i);
  if (healM && (entry.type === "heal" || !msg.includes("→"))) {
    accumulateEffect(entry.actor, meta, "heal", parseFloat(healM[1]));
    return;
  }

  const hpDmgM = msg.match(/HP\s*[−-](\d+(?:\.\d+)?)/i);
  if (hpDmgM) {
    const side = entry.target || entry.actor;
    accumulateEffect(side, meta, "damage", -parseFloat(hpDmgM[1]));
    return;
  }

  const dmgM = msg.match(/[−-](\d+(?:\.\d+)?)\s*HP/i);
  if (dmgM && entry.type === "damage") {
    const side = entry.target || entry.actor;
    accumulateEffect(side, meta, "damage", -parseFloat(dmgM[1]));
  }
}

function tickAccumFromLog(battleState) {
  const log = battleState?.log;
  if (!log) return;
  while (lastLogIndex < log.length) {
    parseLogEntry(log[lastLogIndex], battleState);
    lastLogIndex += 1;
  }
}

function getHpBarChipAnchor(team) {
  const slot = typeof getAvatarSlotEl === "function" ? getAvatarSlotEl(team) : null;
  const hpBar = slot?.querySelector(".avatar-hero-hp-bar");
  const canvas = getCanvasEl();
  if (!hpBar || !canvas) return null;

  const rect = hpBar.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / canvasRect.width;
  const scaleY = canvas.height / canvasRect.height;
  const x = (rect.left + rect.width / 2 - canvasRect.left) * scaleX;
  let y = (rect.top - canvasRect.top) * scaleY - 10;
  if (y > canvas.height - 18) y = canvas.height - 18;
  return { x, y: Math.max(8, y) };
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

function chipLabelValue(entry) {
  return formatDmgVal(Math.round(entry.value));
}

function measureChip(ctx, entry, isCollapse, hiddenCount) {
  ctx.font = `bold ${CHIP_VALUE_SIZE}px sans-serif`;
  const valText = isCollapse ? `+${hiddenCount} ещё ▾` : chipLabelValue(entry);
  const valW = ctx.measureText(valText).width;
  const w = CHIP_PAD_X * 2 + (isCollapse ? 0 : CHIP_ICON_SIZE + CHIP_GAP) + valW;
  const h = CHIP_PAD_Y * 2 + Math.max(CHIP_ICON_SIZE, CHIP_VALUE_SIZE);
  return { w, h, valText };
}

function drawChip(ctx, cx, cy, entry, opts = {}) {
  const isCollapse = !!opts.isCollapse;
  const hiddenCount = opts.hiddenCount || 0;
  const { w, h, valText } = measureChip(ctx, entry, isCollapse, hiddenCount);
  const x = cx - w / 2;
  const y = cy - h;

  ctx.save();
  if (isCollapse) {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    drawRoundRect(ctx, x, y, w, h, CHIP_RADIUS);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#8b949e";
    ctx.font = `bold ${CHIP_VALUE_SIZE}px sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(valText, x + CHIP_PAD_X, y + h / 2);
  } else {
    const borderColor = CHIP_TYPE_COLORS[entry.type] || CHIP_TYPE_COLORS.damage;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    drawRoundRect(ctx, x, y, w, h, CHIP_RADIUS);
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = `${CHIP_ICON_SIZE}px sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#e6edf3";
    ctx.fillText(entry.icon || "❔", x + CHIP_PAD_X, y + h / 2);
    ctx.font = `bold ${CHIP_VALUE_SIZE}px sans-serif`;
    ctx.fillStyle = borderColor;
    ctx.fillText(valText, x + CHIP_PAD_X + CHIP_ICON_SIZE + CHIP_GAP, y + h / 2);
  }
  ctx.restore();

  return { x, y, w, h };
}

function getSideEntries(side) {
  return Object.values(roundDamageAccum[side] || {}).filter((e) => e.value !== 0);
}

function layoutSideChips(ctx, team) {
  const entries = getSideEntries(team);
  if (!entries.length) return null;

  const anchor = getHpBarChipAnchor(team);
  if (!anchor) return null;

  const collapse = entries.length > MAX_VISIBLE_CHIPS;
  const visible = collapse ? entries.slice(0, 3) : entries;
  const hidden = collapse ? entries.slice(3) : [];

  const sizes = visible.map((e) => measureChip(ctx, e, false, 0));
  let collapseSize = null;
  if (collapse) collapseSize = measureChip(ctx, null, true, hidden.length);

  const gap = CHIP_ROW_GAP;
  const totalW = sizes.reduce((s, m) => s + m.w, 0)
    + (collapse ? collapseSize.w : 0)
    + gap * (visible.length + (collapse ? 1 : 0) - 1);

  let cursorX = anchor.x - totalW / 2;
  const cy = anchor.y;
  let collapseBbox = null;

  visible.forEach((entry, i) => {
    const cx = cursorX + sizes[i].w / 2;
    drawChip(ctx, cx, cy, entry);
    cursorX += sizes[i].w + gap;
  });

  if (collapse) {
    const cx = cursorX + collapseSize.w / 2;
    collapseBbox = drawChip(ctx, cx, cy, null, { isCollapse: true, hiddenCount: hidden.length });
    collapseBbox.side = team;
    collapseBbox.hidden = hidden;
    collapseBbox.all = entries;
  }

  return collapseBbox;
}

function drawDamageChips(ctx, battleState) {
  if (!ctx || !battleState) return;
  tickAccumFromLog(battleState);
  collapseBboxes.player = layoutSideChips(ctx, "player");
  collapseBboxes.enemy = layoutSideChips(ctx, "enemy");
}

function ensureDmgPopup() {
  if (dmgPopupEl) return dmgPopupEl;
  const wrap = getCanvasEl()?.parentElement;
  if (!wrap) return null;

  dmgPopupEl = document.createElement("div");
  dmgPopupEl.id = "dmg-popup";
  dmgPopupEl.hidden = true;
  dmgPopupEl.style.cssText = [
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
  wrap.appendChild(dmgPopupEl);
  return dmgPopupEl;
}

function renderDmgPopupContent(entries) {
  const header = '<div style="font-size:11px;color:#8b949e;margin-bottom:8px">Все эффекты раунда</div>';
  const rows = entries.map((entry) => {
    const color = CHIP_TYPE_COLORS[entry.type] || "#8b949e";
    const displayVal = chipLabelValue(entry);
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:13px;line-height:1.3">`
      + `<span style="font-size:16px;width:20px;text-align:center;flex-shrink:0">${entry.icon || "❔"}</span>`
      + `<span style="flex:1;color:#c9d1d9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${entry.name || "Предмет"}</span>`
      + `<span style="font-weight:700;color:${color};flex-shrink:0">${displayVal}</span>`
      + `</div>`;
  }).join("");
  return header + rows;
}

function positionDmgPopup(bbox) {
  const popup = ensureDmgPopup();
  const canvas = getCanvasEl();
  if (!popup || !canvas || !bbox) return;

  popup.innerHTML = renderDmgPopupContent(bbox.all || []);
  popup.hidden = false;
  popup.style.display = "block";

  const canvasRect = canvas.getBoundingClientRect();
  const wrap = canvas.parentElement;
  const wrapRect = wrap?.getBoundingClientRect() || canvasRect;
  const scaleX = canvasRect.width / canvas.width;
  const scaleY = canvasRect.height / canvas.height;

  let left = (bbox.x + bbox.w / 2) * scaleX - popup.offsetWidth / 2;
  let top = bbox.y * scaleY - popup.offsetHeight - 8;

  const maxLeft = wrapRect.width - popup.offsetWidth - 4;
  left = Math.max(4, Math.min(left, maxLeft));
  top = Math.max(4, top);

  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
}

function openDmgPopup(side, bbox) {
  if (!bbox) return;
  popupOpenSide = side;
  positionDmgPopup(bbox);
}

function hitTestBbox(coords, bbox) {
  if (!bbox) return false;
  return coords.x >= bbox.x && coords.x <= bbox.x + bbox.w
    && coords.y >= bbox.y && coords.y <= bbox.y + bbox.h;
}

function handleDmgChipCanvasClick(clientX, clientY) {
  const coords = clientToCanvas(clientX, clientY);
  for (const side of ["player", "enemy"]) {
    const bb = collapseBboxes[side];
    if (hitTestBbox(coords, bb)) {
      if (popupOpenSide === side) closeDmgPopup();
      else openDmgPopup(side, bb);
      return true;
    }
  }
  closeDmgPopup();
  return false;
}
