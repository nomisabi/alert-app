import type { AppCategory } from '@alert-app/shared';

// NewsData.io's categories (https://newsdata.io/documentation), mapped to our own list.
// Used by the NewsData adapter (milestone 5): it polls these per category and maps every
// article's categories back to ours. Users only ever see our categories.

/** Which NewsData.io categories to fetch for each of ours. */
export const NEWSDATA_CATEGORIES: Record<AppCategory, readonly string[]> = {
  world: ['world', 'top'],
  politics: ['politics', 'domestic'],
  business: ['business'],
  technology: ['technology'],
  science: ['science'],
  health: ['health'],
  sports: ['sports'],
  environment: ['environment'],
  // Everything NewsData.io has that isn't mapped above, so no news is lost
  other: ['crime', 'education', 'entertainment', 'food', 'lifestyle', 'tourism', 'other'],
};

/** NewsData.io allows at most 5 categories in one request. */
export const NEWSDATA_MAX_CATEGORIES_PER_REQUEST = 5;

const appCategoryByNewsData = new Map(
  Object.entries(NEWSDATA_CATEGORIES).flatMap(([appCategory, newsDataCategories]) =>
    newsDataCategories.map((category) => [category, appCategory as AppCategory] as const),
  ),
);

/**
 * Our category for a NewsData.io category, e.g. `top` → `world`.
 * Unknown ones (e.g. a category NewsData.io adds later) become `other`.
 */
export function toAppCategory(newsDataCategory: string): AppCategory {
  return appCategoryByNewsData.get(newsDataCategory.toLowerCase()) ?? 'other';
}
