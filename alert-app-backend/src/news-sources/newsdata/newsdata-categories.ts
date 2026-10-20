import type { AppCategory } from '@alert-app/shared';

// NewsData.io's categories (https://newsdata.io/documentation), mapped to our own list.
// The NewsData adapter fetches these per category of ours and maps every article's categories
// back to ours. Users only ever see our categories.

/** Which NewsData.io categories to fetch for each of ours. */
export const NEWSDATA_CATEGORIES: Record<AppCategory, readonly string[]> = {
  world: ['world'],
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

/**
 * NewsData.io categories that are neither fetched nor mapped. `top` means "top story", not a
 * topic: most articles have it next to their real category ("technology, top"). Mapped to
 * `world` (milestone 3), it sent almost every popular article to "World" rules (milestone 5).
 */
export const NEWSDATA_IGNORED_CATEGORIES: readonly string[] = ['top'];

/** NewsData.io allows at most 5 categories in one request. */
export const NEWSDATA_MAX_CATEGORIES_PER_REQUEST = 5;

const appCategoryByNewsData = new Map(
  Object.entries(NEWSDATA_CATEGORIES).flatMap(([appCategory, newsDataCategories]) =>
    newsDataCategories.map((category) => [category, appCategory as AppCategory] as const),
  ),
);

/**
 * Our category for a NewsData.io category, e.g. `domestic` → `politics`.
 * Unknown ones (e.g. a category NewsData.io adds later) become `other`.
 */
export function toAppCategory(newsDataCategory: string): AppCategory {
  return appCategoryByNewsData.get(newsDataCategory.toLowerCase()) ?? 'other';
}

/**
 * Our categories for an article's NewsData.io categories, without duplicates and ignoring `top`.
 * Never empty: an article without a usable category is `other`.
 */
export function toAppCategories(newsDataCategories: readonly string[]): AppCategory[] {
  const categories = newsDataCategories
    .filter((category) => !NEWSDATA_IGNORED_CATEGORIES.includes(category.toLowerCase()))
    .map(toAppCategory);
  return categories.length > 0 ? [...new Set(categories)] : ['other'];
}

/**
 * The `category` parameter of every request of one fetch: one request per category of ours,
 * split when it has more than 5 NewsData.io categories (`other` has 7 → 2 requests).
 * Fetching each category separately means a quiet category doesn't lose its 10 articles to a busy one.
 */
export function newsDataRequestCategories(): string[][] {
  return Object.values(NEWSDATA_CATEGORIES).flatMap((categories) => {
    const requests: string[][] = [];
    for (let start = 0; start < categories.length; start += NEWSDATA_MAX_CATEGORIES_PER_REQUEST) {
      requests.push(categories.slice(start, start + NEWSDATA_MAX_CATEGORIES_PER_REQUEST));
    }
    return requests;
  });
}
