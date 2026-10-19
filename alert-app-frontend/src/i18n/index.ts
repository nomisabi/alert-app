import { validationMessagesEn } from '@alert-app/shared';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import auth from './locales/en/auth.json';
import common from './locales/en/common.json';

export const defaultNS = 'common';

export const resources = {
  // Validation texts come from the shared package, because the backend uses them too
  en: { common, auth, validation: validationMessagesEn },
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
