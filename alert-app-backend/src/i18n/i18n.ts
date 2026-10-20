import { VALIDATION_VALUES, validationMessagesEn } from '@alert-app/shared';
import { HttpStatus } from '@nestjs/common';
import i18next from 'i18next';
import { emailsEn } from './locales/en/emails.js';
import { errorsEn } from './locales/en/errors.js';

// Backend translations: error messages in API responses and email texts.
// Same library and {{value}} syntax as the frontend.

export const SUPPORTED_LANGUAGES = ['en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
const FALLBACK_LANGUAGE: Language = 'en';

const i18n = i18next.createInstance();
void i18n.init({
  resources: {
    en: { errors: errorsEn, validation: validationMessagesEn, emails: emailsEn },
  },
  lng: FALLBACK_LANGUAGE,
  fallbackLng: FALLBACK_LANGUAGE,
  ns: ['errors', 'validation', 'emails'],
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

/**
 * Text for an error code, falling back to the text for the HTTP status.
 * `values` fill in placeholders, e.g. { seconds: 42 } for "{{seconds}}".
 */
export function translateErrorCode(
  language: Language,
  code: string,
  status: number,
  values: Record<string, string | number> = {},
): string {
  if (i18n.exists(`errors:${code}`, { lng: language })) {
    return i18n.t(`errors:${code}`, { lng: language, ...values });
  }

  const statusCode = (HttpStatus[status] as string | undefined) ?? 'INTERNAL_SERVER_ERROR';
  const fallbackCode = status >= 500 ? 'INTERNAL_SERVER_ERROR' : statusCode;
  return i18n.t(`errors:${fallbackCode}`, { lng: language, defaultValue: errorsEn.BAD_REQUEST });
}

/** An email text, e.g. translateEmail('en', 'test.greeting', { name: 'Ann' }). */
export function translateEmail(
  language: Language,
  key: string,
  values: Record<string, string | number> = {},
): string {
  return i18n.t(`emails:${key}`, { lng: language, ...values });
}

/** Text for an i18n key like `validation:username.tooShort` or `errors:USERNAME_IS_ALREADY_TAKEN`. */
export function translateKey(language: Language, key: string): string {
  const knownKey = i18n.exists(key, { lng: language }) ? key : 'validation:invalid';
  return i18n.t(knownKey, { lng: language, ...VALIDATION_VALUES });
}
