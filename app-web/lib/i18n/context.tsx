'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { LanguagePreference, USER_PREFERENCES_EVENT } from '@/app/(app)/_lib/preferences';
import en from './translations/en.json';
import es from './translations/es.json';
import ca from './translations/ca.json';

const DICTIONARIES: Record<LanguagePreference, Record<string, string>> = { en, es, ca };

function readStoredLanguage(): LanguagePreference {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem('bn_language_preference');
  if (stored === 'en' || stored === 'es' || stored === 'ca') return stored;
  const nav = navigator.language?.slice(0, 2);
  if (nav === 'es') return 'es';
  if (nav === 'ca') return 'ca';
  return 'en';
}

type TFn = (key: string, vars?: Record<string, string | number>) => string;

const I18nContext = createContext<{ language: LanguagePreference; t: TFn }>({
  language: 'en',
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<LanguagePreference>('en');

  useEffect(() => {
    setLanguage(readStoredLanguage());
    const handler = (e: Event) => {
      const lang = (e as CustomEvent<{ language?: string }>).detail?.language;
      if (lang === 'en' || lang === 'es' || lang === 'ca') setLanguage(lang);
    };
    window.addEventListener(USER_PREFERENCES_EVENT, handler);
    return () => window.removeEventListener(USER_PREFERENCES_EVENT, handler);
  }, []);

  const t: TFn = (key, vars) => {
    const dict = DICTIONARIES[language] ?? DICTIONARIES.en;
    let str = (dict as Record<string, string>)[key] ?? (DICTIONARIES.en as Record<string, string>)[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replaceAll(`{${k}}`, String(v));
      }
    }
    return str;
  };

  return <I18nContext.Provider value={{ language, t }}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  return useContext(I18nContext);
}
