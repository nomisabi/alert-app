import { APP_CATEGORIES } from '@alert-app/shared';
import {
  NEWSDATA_CATEGORIES,
  NEWSDATA_IGNORED_CATEGORIES,
  NEWSDATA_MAX_CATEGORIES_PER_REQUEST,
  newsDataRequestCategories,
  toAppCategories,
  toAppCategory,
} from './newsdata-categories.js';

// NewsData.io's full category list (https://newsdata.io/documentation)
const ALL_NEWSDATA_CATEGORIES = [
  'business',
  'crime',
  'domestic',
  'education',
  'entertainment',
  'environment',
  'food',
  'health',
  'lifestyle',
  'other',
  'politics',
  'science',
  'sports',
  'technology',
  'top',
  'tourism',
  'world',
];

describe('NewsData.io category mapping', () => {
  it('maps or ignores every NewsData.io category, each exactly once', () => {
    const handled = [...Object.values(NEWSDATA_CATEGORIES).flat(), ...NEWSDATA_IGNORED_CATEGORIES];

    expect(handled.sort()).toEqual(ALL_NEWSDATA_CATEGORIES);
  });

  it('has an entry for each of our categories', () => {
    expect(Object.keys(NEWSDATA_CATEGORIES).sort()).toEqual([...APP_CATEGORIES].sort());
  });

  it('maps NewsData.io categories back to ours', () => {
    expect(toAppCategory('world')).toBe('world');
    expect(toAppCategory('domestic')).toBe('politics');
    expect(toAppCategory('technology')).toBe('technology');
    expect(toAppCategory('tourism')).toBe('other');
  });

  it('ignores case and puts unknown categories into "other"', () => {
    expect(toAppCategory('Sports')).toBe('sports');
    expect(toAppCategory('space')).toBe('other');
  });
});

describe('toAppCategories', () => {
  it('ignores "top" next to a real category', () => {
    expect(toAppCategories(['technology', 'top'])).toEqual(['technology']);
    expect(toAppCategories(['TOP', 'sports'])).toEqual(['sports']);
  });

  it('gives "other" when nothing usable is left', () => {
    expect(toAppCategories(['top'])).toEqual(['other']);
    expect(toAppCategories([])).toEqual(['other']);
  });

  it('removes duplicates', () => {
    expect(toAppCategories(['politics', 'domestic', 'business'])).toEqual(['politics', 'business']);
  });
});

describe('newsDataRequestCategories', () => {
  it('makes 10 requests per fetch: one per category of ours, two for "other"', () => {
    const requests = newsDataRequestCategories();

    expect(requests).toHaveLength(10);
    expect(requests).toContainEqual(['world']);
    expect(requests).toContainEqual(['politics', 'domestic']);
    expect(requests).toContainEqual(['crime', 'education', 'entertainment', 'food', 'lifestyle']);
    expect(requests).toContainEqual(['tourism', 'other']);
  });

  it('never asks for more than 5 categories, and never for "top"', () => {
    const requests = newsDataRequestCategories();

    expect(requests.every((request) => request.length <= NEWSDATA_MAX_CATEGORIES_PER_REQUEST)).toBe(
      true,
    );
    expect(requests.flat()).not.toContain('top');
  });
});
