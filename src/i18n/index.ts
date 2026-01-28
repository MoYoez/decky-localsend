import { en, TranslationKeys } from "./en";
import { zhCN } from "./zh-CN";

const translations: Record<string, TranslationKeys> = {
  en,
  "en-US": en,
  "en-GB": en,
  "zh-CN": zhCN,
  "zh-Hans": zhCN,
  zh: zhCN,
};

let currentLanguage = "en";

/**
 * Initialize i18n with system language detection
 */
export function initI18n(): void {
  try {
    // Try to get Steam's language setting
    const steamLang = (window as any).LocalizationManager?.m_rgLocalesToUse?.[0];
    if (steamLang && translations[steamLang]) {
      currentLanguage = steamLang;
      return;
    }

    // Fallback to browser language
    const browserLang = navigator.language;
    if (translations[browserLang]) {
      currentLanguage = browserLang;
      return;
    }

    // Try base language (e.g., "zh" from "zh-TW")
    const baseLang = browserLang.split("-")[0];
    if (translations[baseLang]) {
      currentLanguage = baseLang;
      return;
    }

    // Default to English
    currentLanguage = "en";
  } catch (e) {
    console.error("Failed to detect language:", e);
    currentLanguage = "en";
  }
}

/**
 * Get current language code
 */
export function getCurrentLanguage(): string {
  return currentLanguage;
}

/**
 * Set language manually
 */
export function setLanguage(lang: string): void {
  if (translations[lang]) {
    currentLanguage = lang;
  }
}

/**
 * Get translation by key path (e.g., "backend.title")
 */
export function t(key: string): string {
  const keys = key.split(".");
  let result: any = translations[currentLanguage] || translations.en;

  for (const k of keys) {
    if (result && typeof result === "object" && k in result) {
      result = result[k];
    } else {
      // Fallback to English if key not found
      result = translations.en;
      for (const fallbackKey of keys) {
        if (result && typeof result === "object" && fallbackKey in result) {
          result = result[fallbackKey];
        } else {
          return key; // Return key if translation not found
        }
      }
      break;
    }
  }

  return typeof result === "string" ? result : key;
}

/**
 * Get all translations for current language
 */
export function getTranslations(): TranslationKeys {
  return translations[currentLanguage] || translations.en;
}

// Initialize on import
initI18n();

export { en, zhCN };
export type { TranslationKeys };
