import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import common from './locales/en/common.json';

export const defaultNS = 'common';

export const resources = {
  en: { common },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  defaultNS,
  interpolation: {
    // React already escapes values
    escapeValue: false,
  },
});

export default i18n;
