import { z } from 'zod';

/**
 * Response of POST /api/admin/news-sources/fetch (202): the fetch is queued, not done yet.
 * While a fetch is still waiting or running, no second one is queued: the response repeats its
 * `batchId`, so two clicks don't use the NewsData.io quota twice.
 */
export const fetchNewsResponseSchema = z.object({
  /** The id of this fetch. The notifications it creates have the same `batchId`. */
  batchId: z.string(),
});
export type FetchNewsResponse = z.infer<typeof fetchNewsResponseSchema>;
