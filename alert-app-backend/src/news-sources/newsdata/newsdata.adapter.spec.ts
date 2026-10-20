import { Logger } from '@nestjs/common';
import { NewsDataAdapter } from './newsdata.adapter.js';

const API_KEY = 'pub_test_key';

/** One article as NewsData.io returns it (only the fields we use, plus one we ignore). */
function newsDataArticle(changes: Record<string, unknown> = {}) {
  return {
    article_id: 'a1',
    link: 'https://example.com/ai-risks',
    title: ' AI risks, value remain unaligned for CIOs ',
    description: ' When trust in AI is low... ',
    content: 'ONLY AVAILABLE IN PAID PLANS',
    pubDate: '2026-10-19 20:21:00',
    pubDateTZ: 'UTC',
    image_url: null,
    source_name: 'Ciodive',
    category: ['technology', 'top'],
    duplicate: false,
    ...changes,
  };
}

const success = (results: unknown[]) =>
  Response.json({ status: 'success', totalResults: results.length, results, nextPage: null });

/** The URL the adapter fetched (it passes a URL object). */
const urlOf = (input: unknown) => new URL(input as URL);

/** The `category` parameter of a request. */
const categoryOf = (input: unknown) => urlOf(input).searchParams.get('category');

describe('NewsDataAdapter', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const adapter = new NewsDataAdapter(API_KEY);

  beforeEach(() => {
    fetchMock.mockReset();
    // An empty answer for every request unless a test says otherwise
    fetchMock.mockImplementation(() => Promise.resolve(success([])));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('makes one request per category of ours: English, with the key, 10 in total', async () => {
    await adapter.fetchLatest();

    expect(fetchMock).toHaveBeenCalledTimes(10);
    const first = urlOf(fetchMock.mock.calls[0][0]);
    expect(first.origin + first.pathname).toBe('https://newsdata.io/api/1/latest');
    expect(first.searchParams.get('apikey')).toBe(API_KEY);
    expect(first.searchParams.get('language')).toBe('en');
    expect(fetchMock.mock.calls.map(([input]) => categoryOf(input))).toContain('politics,domestic');
  });

  it('converts articles to our shape', async () => {
    fetchMock.mockResolvedValueOnce(success([newsDataArticle()]));

    expect(await adapter.fetchLatest()).toEqual([
      {
        sourceId: 'newsdata',
        externalId: 'a1',
        url: 'https://example.com/ai-risks',
        title: 'AI risks, value remain unaligned for CIOs',
        description: 'When trust in AI is low...',
        imageUrl: null,
        sourceName: 'Ciodive',
        // pubDate is UTC
        publishedAt: new Date('2026-10-19T20:21:00Z'),
        // "top" is ignored
        categories: ['technology'],
        language: 'en',
      },
    ]);
  });

  it('skips duplicates of other sites, unusable articles, and the same URL twice', async () => {
    fetchMock
      .mockResolvedValueOnce(
        success([
          newsDataArticle(),
          newsDataArticle({ article_id: 'a2', link: 'https://example.com/b', duplicate: true }),
          newsDataArticle({ article_id: 'a3', link: 'not a url' }),
          newsDataArticle({ article_id: 'a4', link: 'https://example.com/c', title: '' }),
          newsDataArticle({
            article_id: 'a5',
            link: 'https://example.com/d',
            pubDate: 'yesterday',
          }),
        ]),
      )
      // The same article again, for another category
      .mockResolvedValueOnce(success([newsDataArticle()]));

    const articles = await adapter.fetchLatest();

    expect(articles.map((article) => article.externalId)).toEqual(['a1']);
  });

  it('gives "other" to an article without a usable category, and empty texts become null', async () => {
    fetchMock.mockResolvedValueOnce(
      success([
        newsDataArticle({ category: ['top'], description: '  ', source_name: null }),
        newsDataArticle({ article_id: 'a2', link: 'https://example.com/b', category: null }),
      ]),
    );

    const [onlyTop, noCategory] = await adapter.fetchLatest();

    expect(onlyTop).toMatchObject({ categories: ['other'], description: null, sourceName: null });
    expect(noCategory.categories).toEqual(['other']);
  });

  it('keeps the other categories when one request fails, with a warning without the key', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    fetchMock
      .mockResolvedValueOnce(
        Response.json(
          {
            status: 'error',
            results: { message: 'Rate limit exceeded', code: 'RateLimitExceeded' },
          },
          { status: 429 },
        ),
      )
      .mockResolvedValueOnce(success([newsDataArticle()]));

    const articles = await adapter.fetchLatest();

    expect(articles).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0][0]);
    expect(message).toContain('HTTP 429: RateLimitExceeded Rate limit exceeded');
    expect(message).not.toContain(API_KEY);
  });

  it('throws when every request fails', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('getaddrinfo ENOTFOUND')));

    await expect(adapter.fetchLatest()).rejects.toThrow('All 10 NewsData.io requests failed');
  });
});
