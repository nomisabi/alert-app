import { z } from 'zod';
import { APP_CATEGORIES } from '../constants/categories.js';

export const appCategorySchema = z.enum(APP_CATEGORIES);

export type AppCategory = z.infer<typeof appCategorySchema>;
