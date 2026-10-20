import type { AppCategory } from '@alert-app/shared';

/** One article in our own shape, whatever the source. Saved as an `Article` row. */
export interface NormalizedArticle {
  /** The adapter's `sourceId`, e.g. "newsdata" */
  sourceId: string;
  /** The provider's own id */
  externalId: string;
  url: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  /** The publisher, e.g. "Ciodive" */
  sourceName: string | null;
  publishedAt: Date;
  /** Ours, already mapped from the provider's. At least one. */
  categories: AppCategory[];
  /** e.g. "en" */
  language: string | null;
}

/**
 * One news provider. Adding a source = one class that implements this (plus its category
 * mapping), added to the NEWS_SOURCES list in NewsSourcesModule.
 */
export interface NewsSourceAdapter {
  readonly sourceId: string;
  /**
   * The provider's latest articles. Some may already be saved: the URL check skips them.
   * Throws only when nothing could be fetched at all.
   */
  fetchLatest(): Promise<NormalizedArticle[]>;
}

/** Injection token for the list of configured sources (an interface can't be one, see EmailProvider). */
export const NEWS_SOURCES = Symbol('NEWS_SOURCES');
