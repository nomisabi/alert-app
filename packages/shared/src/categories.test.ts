import { describe, expect, it } from 'vitest';
import { appCategorySchema } from './categories.js';

describe('appCategorySchema', () => {
  it('accepts our categories', () => {
    expect(appCategorySchema.parse('technology')).toBe('technology');
  });

  it('rejects provider-specific or unknown categories', () => {
    expect(appCategorySchema.safeParse('top').success).toBe(false);
  });
});
