import { z } from 'zod';

/**
 * Our own news categories. Users only ever see these. Each news source adapter
 * maps its provider-specific categories onto this list.
 * Starting list; to be finalized with the data model (Phase 1).
 */
export const APP_CATEGORIES = [
  'world',
  'business',
  'technology',
  'science',
  'health',
  'sports',
  'environment',
] as const;

export const appCategorySchema = z.enum(APP_CATEGORIES);

export type AppCategory = z.infer<typeof appCategorySchema>;
