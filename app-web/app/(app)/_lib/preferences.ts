export type ThemePreference = 'light' | 'dark' | 'system';
export type LanguagePreference = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt';

export const USER_PREFERENCES_EVENT = 'bn:user-preferences-updated';

export const STORAGE_THEME_KEY = 'bn_theme_preference';
export const STORAGE_LANGUAGE_KEY = 'bn_language_preference';

export function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function isLanguagePreference(value: string | null | undefined): value is LanguagePreference {
  return value === 'en' || value === 'es' || value === 'fr' || value === 'de' || value === 'it' || value === 'pt';
}

export function resolveTheme(theme: ThemePreference): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyUserPreferences(theme: ThemePreference, language: LanguagePreference) {
  if (typeof document === 'undefined') return;

  const resolvedTheme = resolveTheme(theme);
  const root = document.documentElement;

  root.dataset.themePreference = theme;
  root.dataset.theme = resolvedTheme;
  root.lang = language;

  // Helps native form controls match the selected appearance.
  root.style.colorScheme = resolvedTheme;
}

export function readStoredPreferences(): {
  theme: ThemePreference | null;
  language: LanguagePreference | null;
} {
  if (typeof window === 'undefined') {
    return { theme: null, language: null };
  }

  const themeRaw = window.localStorage.getItem(STORAGE_THEME_KEY);
  const languageRaw = window.localStorage.getItem(STORAGE_LANGUAGE_KEY);

  return {
    theme: isThemePreference(themeRaw) ? themeRaw : null,
    language: isLanguagePreference(languageRaw) ? languageRaw : null,
  };
}

export function writeStoredPreferences(theme: ThemePreference, language: LanguagePreference) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_THEME_KEY, theme);
  window.localStorage.setItem(STORAGE_LANGUAGE_KEY, language);
}
