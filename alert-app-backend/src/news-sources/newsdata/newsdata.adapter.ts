import { tz } from '@date-fns/tz';
import { Logger } from '@nestjs/common';
import { isValid, parse } from 'date-fns';
import { z } from 'zod';
import type { NewsSourceAdapter, NormalizedArticle } from '../news-source-adapter.js';
import { newsDataRequestCategories, toAppCategories } from './newsdata-categories.js';

const LATEST_NEWS_URL = 'https://newsdata.io/api/1/latest';
/** Only English for now: the UI and the keywords are English (manager question 2). */
const LANGUAGE = 'en';

// Only the fields we use. Free-plan responses have more (content: "ONLY AVAILABLE IN PAID PLANS", ...).
const newsDataArticleSchema = z.object({
  article_id: z.string().min(1),
  link: z.url(),
  title: z.string().trim().min(1),
  description: z.string().nullish(),
  // "2026-10-19 20:21:00", in the time zone of pubDateTZ (UTC so far)
  pubDate: z.string(),
  pubDateTZ: z.string().nullish(),
  image_url: z.string().nullish(),
  source_name: z.string().nullish(),
  category: z.array(z.string()).nullish(),
  // true = the same story was already published by another site
  duplicate: z.boolean().nullish(),
});
type NewsDataArticle = z.infer<typeof newsDataArticleSchema>;

const newsDataResponseSchema = z.object({
  status: z.literal('success'),
  // Checked one by one: one odd article shouldn't throw away the other nine
  results: z.array(z.unknown()),
});

// Errors look like { status: "error", results: { message, code } }
const newsDataErrorSchema = z.object({
  results: z.object({ message: z.string().optional(), code: z.string().optional() }),
});

/**
 * NewsData.io's "latest news" endpoint (free plan: ~200 requests a day, 10 articles each,
 * 30 requests per 15 minutes). One fetch = 10 requests, one per category of ours (see
 * newsDataRequestCategories). Created by NewsSourcesModule only when NEWSDATA_API_KEY is set.
 */
export class NewsDataAdapter implements NewsSourceAdapter {
  readonly sourceId = 'newsdata';
  private readonly logger = new Logger(NewsDataAdapter.name);

  constructor(private readonly apiKey: string) {}

  async fetchLatest(): Promise<NormalizedArticle[]> {
    const requests = newsDataRequestCategories();
    // By URL: the same article can come back for two categories (e.g. "politics, business")
    const articles = new Map<string, NormalizedArticle>();
    let failed = 0;

    // One after the other, not all at once: gentler on the rate limit, and a failed request
    // only loses its own category
    for (const categories of requests) {
      try {
        for (const article of await this.fetchCategories(categories)) {
          articles.set(article.url, article);
        }
      } catch (error) {
        failed++;
        this.logger.warn(
          `Fetching "${categories.join(',')}" failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (failed === requests.length) {
      throw new Error(
        `All ${requests.length} NewsData.io requests failed (see the warnings above)`,
      );
    }
    return [...articles.values()];
  }

  private async fetchCategories(categories: string[]): Promise<NormalizedArticle[]> {
    const url = new URL(LATEST_NEWS_URL);
    url.search = new URLSearchParams({
      apikey: this.apiKey,
      language: LANGUAGE,
      category: categories.join(','),
    }).toString();

    // Never log `url`: it contains the API key
    const response = await fetch(url);
    const body: unknown = await response.json().catch(() => undefined);

    if (!response.ok) {
      const error = newsDataErrorSchema.safeParse(body).data?.results;
      throw new Error(
        `HTTP ${response.status}${error ? `: ${error.code ?? ''} ${error.message ?? ''}`.trimEnd() : ''}`,
      );
    }

    const { results } = newsDataResponseSchema.parse(body);
    return results.flatMap((result) => {
      const article = this.normalize(result);
      return article ? [article] : [];
    });
  }

  /** Our shape, or null for an article we skip (unusable, or a duplicate of another site's story). */
  private normalize(result: unknown): NormalizedArticle | null {
    const parsed = newsDataArticleSchema.safeParse(result);
    if (!parsed.success) {
      this.logger.debug(`Skipped an article: ${z.prettifyError(parsed.error)}`);
      return null;
    }
    const article: NewsDataArticle = parsed.data;
    if (article.duplicate) return null;

    const publishedAt = parse(article.pubDate, 'yyyy-MM-dd HH:mm:ss', new Date(), {
      in: tz(article.pubDateTZ ?? 'UTC'),
    });
    if (!isValid(publishedAt)) return null;

    return {
      sourceId: this.sourceId,
      externalId: article.article_id,
      url: article.link,
      title: article.title,
      description: article.description?.trim() || null,
      imageUrl: article.image_url || null,
      sourceName: article.source_name?.trim() || null,
      // A plain Date (parse returns a TZDate), so Prisma and comparisons see a normal date
      publishedAt: new Date(publishedAt.getTime()),
      categories: toAppCategories(article.category ?? []),
      language: LANGUAGE,
    };
  }
}
