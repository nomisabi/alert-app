import { tz } from '@date-fns/tz';
import { format, type Locale } from 'date-fns';
import { enUS } from 'date-fns/locale';
import i18n from '../../i18n';

// Add a date-fns locale here when a new UI language is added.
const dateLocales: Record<string, Locale> = {
  en: enUS,
};

export function getDateLocale(language: string = i18n.language): Locale {
  return dateLocales[language] ?? enUS;
}

/**
 * Formats a date in the current UI language.
 * @param pattern date-fns format pattern, e.g. 'PP' (Oct 19, 2026) or 'PPp' (with time)
 * @param timeZone IANA time zone (e.g. 'Europe/Budapest'). Defaults to the browser's time zone.
 */
export function formatDate(date: Date | number | string, pattern = 'PP', timeZone?: string) {
  return format(date, pattern, {
    locale: getDateLocale(),
    in: timeZone ? tz(timeZone) : undefined,
  });
}
