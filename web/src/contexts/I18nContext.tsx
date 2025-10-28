"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { translations, type Language, type TranslationKey, type TranslationParams } from "@/i18n/dictionary";

const STORAGE_KEY = "sct-lang";
const AVAILABLE_LANGS: Language[] = ["en", "es"];

type I18nContextValue = {
  lang: Language;
  available: Language[];
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function formatWithParams(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return Object.entries(params).reduce((acc, [key, value]) => acc.replaceAll(`{{${key}}}`, String(value)), template);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Important for hydration: default to 'en' so SSR and initial client render match
  const [lang, setLang] = useState<Language>("en");

  // After mount, read the preference and update. This avoids hydration mismatches.
  useEffect(() => {
    try {
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (stored && AVAILABLE_LANGS.includes(stored as Language)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLang(stored as Language);
      }
    } catch {}
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLang(next);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, next);
      }
    } catch {}
  }, []);

  const translate = useCallback(
    (key: TranslationKey, params?: TranslationParams) => {
      const langTable = translations[lang] ?? translations.en;
      const fallbackTable = translations.en;
      const template = langTable[key] ?? fallbackTable[key] ?? key;
      return formatWithParams(template, params);
    },
    [lang]
  );

  const value = useMemo<I18nContextValue>(() => ({ lang, available: AVAILABLE_LANGS, setLanguage, t: translate }), [lang, setLanguage, translate]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("I18nProvider missing");
  return ctx;
}
