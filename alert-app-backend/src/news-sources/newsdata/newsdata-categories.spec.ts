import { APP_CATEGORIES } from '@alert-app/shared';
import {
  NEWSDATA_CATEGORIES,
  NEWSDATA_MAX_CATEGORIES_PER_REQUEST,
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
  it('maps every NewsData.io category to exactly one of ours', () => {
    const mapped = Object.values(NEWSDATA_CATEGORIES).flat();

    expect([...mapped].sort()).toEqual(ALL_NEWSDATA_CATEGORIES);
  });

  it('has an entry for each of our categories', () => {
    expect(Object.keys(NEWSDATA_CATEGORIES).sort()).toEqual([...APP_CATEGORIES].sort());
  });

  it('can fetch every category of ours in requests of at most 5 NewsData.io categories', () => {
    // "other" has 7, so it needs 2 requests: the adapter must split it (milestone 5)
    const largest = Math.max(...Object.values(NEWSDATA_CATEGORIES).map((list) => list.length));
    expect(Math.ceil(largest / NEWSDATA_MAX_CATEGORIES_PER_REQUEST)).toBe(2);
  });

  it('maps NewsData.io categories back to ours', () => {
    expect(toAppCategory('top')).toBe('world');
    expect(toAppCategory('domestic')).toBe('politics');
    expect(toAppCategory('technology')).toBe('technology');
    expect(toAppCategory('tourism')).toBe('other');
  });

  it('ignores case and puts unknown categories into "other"', () => {
    expect(toAppCategory('Sports')).toBe('sports');
    expect(toAppCategory('space')).toBe('other');
  });
});
