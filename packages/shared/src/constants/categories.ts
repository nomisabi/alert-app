/**
 * Our own news categories. Users only ever see these. Each news source adapter
 * maps its provider-specific categories onto this list.
 * "other" collects every provider category that isn't mapped to one of the others.
 */
export const APP_CATEGORIES = [
  'world',
  'politics',
  'business',
  'technology',
  'science',
  'health',
  'sports',
  'environment',
  'other',
] as const;
