'use client';

import { useEffect, useState } from 'react';
import {
  applyUserPreferences,
  isLanguagePreference,
  isThemePreference,
  LanguagePreference,
  readStoredPreferences,
  ThemePreference,
  USER_PREFERENCES_EVENT,
  writeStoredPreferences,
} from '../_lib/preferences';

interface SettingsPayload {
  profile?: {
    theme?: string | null;
    language?: string | null;
  };
}

interface PreferencesEventDetail {
  theme?: ThemePreference;
  language?: LanguagePreference;
}

export function UserPreferencesSync() {
  const [theme, setTheme] = useState<ThemePreference>('dark');
  const [language, setLanguage] = useState<LanguagePreference>('en');

  useEffect(() => {
    const stored = readStoredPreferences();
    if (stored.theme) {
      setTheme(stored.theme);
    }
    if (stored.language) {
      setLanguage(stored.language);
    }

    applyUserPreferences(stored.theme ?? 'dark', stored.language ?? 'en');

    let ignore = false;

    fetch('/api/settings')
      .then((resp) => (resp.ok ? resp.json() : null))
      .then((data: SettingsPayload | null) => {
        if (ignore || !data?.profile) return;

        const nextTheme = isThemePreference(data.profile.theme) ? data.profile.theme : (stored.theme ?? 'dark');
        const nextLanguage = isLanguagePreference(data.profile.language) ? data.profile.language : (stored.language ?? 'en');

        setTheme(nextTheme);
        setLanguage(nextLanguage);
      })
      .catch(() => {
        // Non-fatal: keep local fallback.
      });

    function handlePreferencesEvent(event: Event) {
      const detail = (event as CustomEvent<PreferencesEventDetail>).detail;
      if (!detail) return;

      if (detail.theme) {
        setTheme(detail.theme);
      }
      if (detail.language) {
        setLanguage(detail.language);
      }
    }

    window.addEventListener(USER_PREFERENCES_EVENT, handlePreferencesEvent as EventListener);

    return () => {
      ignore = true;
      window.removeEventListener(USER_PREFERENCES_EVENT, handlePreferencesEvent as EventListener);
    };
  }, []);

  useEffect(() => {
    applyUserPreferences(theme, language);
    writeStoredPreferences(theme, language);
  }, [theme, language]);

  useEffect(() => {
    if (theme !== 'system') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyUserPreferences(theme, language);

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [theme, language]);

  return null;
}
