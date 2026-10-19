import { VALIDATION_VALUES, validationMessagesEn } from '@alert-app/shared';
import { HttpStatus } from '@nestjs/common';
import i18next from 'i18next';
import { errorsEn } from './locales/en/errors.js';

// Backend translations: error messages in API responses. Same library and {{value}} syntax as the frontend.

export const SUPPORTED_LANGUAGES = ['en'] as const;
type Language = (typeof SUPPORTED_LANGUAGES)[number];
const FALLBACK_LANGUAGE: Language = 'en';

const i18n = i18next.createInstance();
void i18n.init({
  resources: {
    en: { errors: errorsEn, validation: validationMessagesEn },
  },
  lng: FALLBACK_LANGUAGE,
  fallbackLng: FALLBACK_LANGUAGE,
  ns: ['errors', 'validation'],
  defaultNS: 'errors',
  // The resources are in memory, so init can finish synchronously
  initAsync: false,
  interpolation: { escapeValue: false },
});

/**
 * Picks the first supported language from an Accept-Language header,
 * e.g. "de-DE,de;q=0.9,en;q=0.8" → "en" (while only English is supported).
 */
export function pickLanguage(acceptLanguage: string | undefined): Language {
  const requested = (acceptLanguage ?? '')
    .split(',')
    .map((part) => part.split(';')[0].trim().split('-')[0].toLowerCase());

  return SUPPORTED_LANGUAGES.find((language) => requested.includes(language)) ?? FALLBACK_LANGUAGE;
}

/** Text for an error code, falling back to the text for the HTTP status. */
export function translateErrorCode(language: Language, code: string, status: number): string {
  if (i18n.exists(`errors:${code}`, { lng: language })) {
    return i18n.t(`errors:${code}`, { lng: language });
  }

  const statusCode = (HttpStatus[status] as string | undefined) ?? 'INTERNAL_SERVER_ERROR';
  const fallbackCode = status >= 500 ? 'INTERNAL_SERVER_ERROR' : statusCode;
  return i18n.t(`errors:${fallbackCode}`, { lng: language, defaultValue: errorsEn.BAD_REQUEST });
}

/** Text for an i18n key like `validation:username.tooShort` or `errors:USERNAME_IS_ALREADY_TAKEN`. */
export function translateKey(language: Language, key: string): string {
  const knownKey = i18n.exists(key, { lng: language }) ? key : 'validation:invalid';
  return i18n.t(knownKey, { lng: language, ...VALIDATION_VALUES });
}
