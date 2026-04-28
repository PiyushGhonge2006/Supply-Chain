import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en";
import hi from "./locales/hi";
import mr from "./locales/mr";
import bn from "./locales/bn";
import ta from "./locales/ta";
import te from "./locales/te";

const STORAGE_KEY = "supply-chain.lang";

const saved =
  typeof window !== "undefined"
    ? window.localStorage.getItem(STORAGE_KEY) ?? "en"
    : "en";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    mr: { translation: mr },
    bn: { translation: bn },
    ta: { translation: ta },
    te: { translation: te },
  },
  lng: saved,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function changeLanguage(lng: string) {
  i18n.changeLanguage(lng);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, lng);
  }
}

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English",  native: "English"  },
  { code: "hi", label: "Hindi",    native: "हिन्दी"     },
  { code: "mr", label: "Marathi",  native: "मराठी"     },
  { code: "bn", label: "Bengali",  native: "বাংলা"      },
  { code: "ta", label: "Tamil",    native: "தமிழ்"     },
  { code: "te", label: "Telugu",   native: "తెలుగు"    },
] as const;

export default i18n;
