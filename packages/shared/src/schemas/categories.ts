import { z } from 'zod';
import { APP_CATEGORIES } from '../constants/categories.js';

export const appCategorySchema = z.enum(APP_CATEGORIES);

export type AppCategory = z.infer<typeof appCategorySchema>;

/** One category in GET /api/categories. Only the id: the frontend translates it. */
export const categorySchema = z.object({
  id: appCategorySchema,
});
export type Category = z.infer<typeof categorySchema>;

/** Response of GET /api/categories, in display order. */
export const categoryListSchema = z.object({
  items: z.array(categorySchema),
});
export type CategoryList = z.infer<typeof categoryListSchema>;
