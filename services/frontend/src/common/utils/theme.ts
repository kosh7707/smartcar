export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "aegis:theme";
const THEME_PREFERENCES: ThemePreference[] = ["light", "dark", "system"];

function normalizeThemePreference(pref: string | null | undefined): ThemePreference {
  if (pref && THEME_PREFERENCES.includes(pref as ThemePreference)) {
    return pref as ThemePreference;
  }
  return "system";
}

export function isThemePreferenceEnabled(pref: ThemePreference): boolean {
  return THEME_PREFERENCES.includes(pref);
}

export function getThemePreference(): ThemePreference {
  return normalizeThemePreference(localStorage.getItem(STORAGE_KEY));
}

export function setThemePreference(pref: ThemePreference): void {
  const normalized = normalizeThemePreference(pref);
  localStorage.setItem(STORAGE_KEY, normalized);
  applyTheme(normalized);
}

export function applyTheme(pref: ThemePreference): void {
  const normalized = normalizeThemePreference(pref);
  const isDark =
    normalized === "dark"
    || (normalized === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
}

export function initTheme(): void {
  const pref = getThemePreference();
  applyTheme(pref);

  const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
  if (!mediaQuery?.addEventListener) return;

  mediaQuery.addEventListener("change", () => {
    if (getThemePreference() === "system") {
      applyTheme("system");
    }
  });
}
