const THEME_KEY = "sportbet_theme";

export function getStoredTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === "night" ? "night" : "day";
  } catch {
    return "day";
  }
}

export function applyTheme(theme) {
  const next = theme === "night" ? "night" : "day";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* ignore */
  }
  return next;
}

export function toggleTheme() {
  return applyTheme(getStoredTheme() === "day" ? "night" : "day");
}

export function initTheme() {
  applyTheme(getStoredTheme());
}
