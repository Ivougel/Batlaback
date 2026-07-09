/**
 * Пресет верхнего UX карточки героя на prep (localStorage: bb-prep-hero-card-preset).
 * classic — портрет на всю высоту карточки; banner — компактная шапка по UI_UX.md.
 */
import type { PrepHeroCardPresetId } from "../types/game";

const PREP_HERO_CARD_PRESET_STORAGE_KEY = "bb-prep-hero-card-preset";

interface PrepHeroCardPresetMeta {
  id: PrepHeroCardPresetId;
  label: string;
  hint: string;
  emoji: string;
}

const PREP_HERO_CARD_PRESETS: Record<PrepHeroCardPresetId, PrepHeroCardPresetMeta> = {
  classic: {
    id: "classic",
    label: "Классическая",
    hint: "Bust-портрет на всю высоту карточки, мутации и усиления справа",
    emoji: "🃏",
  },
  banner: {
    id: "banner",
    label: "Баннер",
    hint: "Компактная шапка: портрет + путь/прогресс, адаптивно под профиль экрана",
    emoji: "📋",
  },
};

function getPrepHeroCardPresetId(): PrepHeroCardPresetId {
  try {
    const stored = localStorage.getItem(PREP_HERO_CARD_PRESET_STORAGE_KEY) as PrepHeroCardPresetId | null;
    return stored && PREP_HERO_CARD_PRESETS[stored] ? stored : "classic";
  } catch {
    return "classic";
  }
}

function getPrepHeroCardPresetMeta(
  presetId: PrepHeroCardPresetId = getPrepHeroCardPresetId(),
): PrepHeroCardPresetMeta {
  return PREP_HERO_CARD_PRESETS[presetId] || PREP_HERO_CARD_PRESETS.classic;
}

function isPrepHeroCardBannerPreset(): boolean {
  return getPrepHeroCardPresetId() === "banner";
}

function applyPrepHeroCardPreset(presetId: string): void {
  const preset = getPrepHeroCardPresetMeta(presetId as PrepHeroCardPresetId);
  const root = document.documentElement;
  root.dataset.prepHeroCardPreset = preset.id;
  try {
    localStorage.setItem(PREP_HERO_CARD_PRESET_STORAGE_KEY, preset.id);
  } catch {
    /* ignore */
  }

  if (typeof window.syncPrepHeroCardPortraitSize === "function") {
    window.syncPrepHeroCardPortraitSize();
  }
  if (typeof syncPrepHudCollapseChrome === "function") {
    syncPrepHudCollapseChrome();
  }
  if (typeof renderPlayerProfiles === "function") {
    try {
      renderPlayerProfiles();
    } catch {
      /* profiles may not exist yet */
    }
  }

  syncPrepHeroCardPresetSettingsUi();
}

function syncPrepHeroCardPresetSettingsUi(): void {
  const current = getPrepHeroCardPresetId();
  document.querySelectorAll<HTMLInputElement>('input[name="prep-hero-card-preset"]').forEach((input) => {
    input.checked = input.value === current;
  });
  document.querySelectorAll(".settings-prep-hero-card-option").forEach((label) => {
    const input = label.querySelector<HTMLInputElement>('input[name="prep-hero-card-preset"]');
    label.classList.toggle("is-selected", input?.value === current);
  });
}

function initPrepHeroCardPreset(): void {
  applyPrepHeroCardPreset(getPrepHeroCardPresetId());
}

function initPrepHeroCardPresetControls(): void {
  document.querySelectorAll<HTMLInputElement>('input[name="prep-hero-card-preset"]').forEach((input) => {
    input.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      if (!target.checked) return;
      applyPrepHeroCardPreset(target.value);
    });
  });
  syncPrepHeroCardPresetSettingsUi();
}
