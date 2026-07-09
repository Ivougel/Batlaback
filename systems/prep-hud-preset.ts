/**
 * Пресет HUD боя (localStorage: bb-prep-hud-preset).
 * hero-card — flank-портреты; unit-frame — MMORPG unit frames (только бой).
 */
import type { PrepHudPresetId } from "../types/game";

const PREP_HUD_PRESET_STORAGE_KEY = "bb-prep-hud-preset";

interface PrepHudPresetMeta {
  id: PrepHudPresetId;
  label: string;
  hint: string;
  emoji: string;
}

const PREP_HUD_PRESETS: Record<PrepHudPresetId, PrepHudPresetMeta> = {
  "hero-card": {
    id: "hero-card",
    label: "Карточка героя",
    hint: "Прямоугольный bust-портрет, мутации и усиления справа",
    emoji: "🃏",
  },
  "unit-frame": {
    id: "unit-frame",
    label: "Unit Frame",
    hint: "Круглые портреты и полосы HP — только в фазе боя",
    emoji: "⚔️",
  },
};

function getPrepHudPresetId(): PrepHudPresetId {
  try {
    const stored = localStorage.getItem(PREP_HUD_PRESET_STORAGE_KEY) as PrepHudPresetId | null;
    return stored && PREP_HUD_PRESETS[stored] ? stored : "hero-card";
  } catch {
    return "hero-card";
  }
}

function getPrepHudPresetMeta(presetId: PrepHudPresetId = getPrepHudPresetId()): PrepHudPresetMeta {
  return PREP_HUD_PRESETS[presetId] || PREP_HUD_PRESETS["hero-card"];
}

function isPrepHudPresetUnitFrame(): boolean {
  return getPrepHudPresetId() === "unit-frame";
}

function applyPrepHudPreset(presetId: string): void {
  const preset = getPrepHudPresetMeta(presetId as PrepHudPresetId);
  const root = document.documentElement;
  root.dataset.prepHudPreset = preset.id;
  try {
    localStorage.setItem(PREP_HUD_PRESET_STORAGE_KEY, preset.id);
  } catch {
    /* ignore */
  }

  if (typeof syncUnitFrameHudChrome === "function") {
    syncUnitFrameHudChrome();
  } else if (typeof syncPrepUnitFrameHudChrome === "function") {
    syncPrepUnitFrameHudChrome();
  }
  if (typeof renderPlayerProfiles === "function") {
    try {
      renderPlayerProfiles();
    } catch {
      /* profiles may not exist yet */
    }
  }

  syncPrepHudPresetSettingsUi();
}

function syncPrepHudPresetSettingsUi(): void {
  const current = getPrepHudPresetId();
  document.querySelectorAll<HTMLInputElement>('input[name="prep-hud-preset"]').forEach((input) => {
    input.checked = input.value === current;
  });
  document.querySelectorAll(".settings-prep-hud-option").forEach((label) => {
    const input = label.querySelector<HTMLInputElement>('input[name="prep-hud-preset"]');
    label.classList.toggle("is-selected", input?.value === current);
  });
}

function initPrepHudPreset(): void {
  applyPrepHudPreset(getPrepHudPresetId());
}

function initPrepHudPresetControls(): void {
  document.querySelectorAll<HTMLInputElement>('input[name="prep-hud-preset"]').forEach((input) => {
    input.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      if (!target.checked) return;
      applyPrepHudPreset(target.value);
    });
  });
  syncPrepHudPresetSettingsUi();
}
