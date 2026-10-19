import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants/pagination.js';

/**
 * `page` and `pageSize` query parameters of list endpoints.
 * Query parameters always arrive as text, so `z.coerce` turns "2" into 2.
 */
export const paginationQuerySchema = z.object({
  /** 1-based. A page after the last one returns no items (not an error). */
  page: z.coerce.number('invalid').int('invalid').min(1, 'invalid').default(1),
  pageSize: z.coerce
    .number('invalid')
    .int('invalid')
    .min(1, 'invalid')
    .max(MAX_PAGE_SIZE, 'invalid')
    .default(DEFAULT_PAGE_SIZE),
});

/** Response of every list endpoint: one page of items plus the total count for the pagination. */
export function paginatedSchema<Item extends z.ZodType>(item: Item) {
  return z.object({
    items: z.array(item),
    /** Number of items on all pages together. */
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  });
}
