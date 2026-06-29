// Solo game settings — the single source of truth for what's in play. Persisted
// to localStorage so choices stick between sessions. Everything is ON by default
// (opt-out): you remove things in the Game Settings modal, you don't opt in.

const KEY = 'freakquencySettings';

const DEFAULTS = {
  levels: { 1: true, 2: true, 3: true, 4: true, 5: true },
  allowContact: true,
  allowTarget: true,
  allowNever: true,
  allowWould: true,
  intensity: 2,    // After Dark intensity 0–5 (Plain → Unhinged); weights the draw
  timerSeconds: 0,
  categories: {}   // custom category id -> enabled (missing = enabled by default)
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      ...DEFAULTS,
      ...saved,
      levels: { ...DEFAULTS.levels, ...(saved.levels || {}) },
      categories: { ...(saved.categories || {}) }
    };
  } catch {
    return { ...DEFAULTS, levels: { ...DEFAULTS.levels }, categories: {} };
  }
}

// Live object — imported directly by the draw logic and the settings UI.
export const settings = load();

export function saveSettings() {
  localStorage.setItem(KEY, JSON.stringify(settings));
}

// A custom category counts as enabled unless explicitly turned off.
export function isCategoryEnabled(id) {
  return settings.categories[id] !== false;
}
