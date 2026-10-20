import type { FetchNewsResponse } from '@alert-app/shared';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import type { Env } from '../src/config/env.js';
import {
  NEWS_SOURCES,
  type NewsSourceAdapter,
  type NormalizedArticle,
} from '../src/news-sources/news-source-adapter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { INGEST_QUEUE } from '../src/queues/queues.js';
import { setupApp } from '../src/setup-app.js';

// End-to-end test of fetching news: real app, database and Redis (npm run db:up first), with a
// fake news source instead of NewsData.io. The queues have their own prefix (test/setup-e2e.ts).
describe('News sources (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ingestQueue: Queue;
  let origin: string;

  const runId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const emailFor = (name: string) => `e2e-${runId}-${name}@example.com`;
  const urlPrefix = `https://example.com/e2e-${runId}/`;

  const article = (name: string, changes: Partial<NormalizedArticle> = {}): NormalizedArticle => ({
    sourceId: 'fake',
    externalId: `${runId}-${name}`,
    url: `${urlPrefix}${name}`,
    title: `Article ${name}`,
    description: null,
    imageUrl: null,
    sourceName: 'Example',
    publishedAt: new Date('2026-10-19T20:21:00Z'),
    categories: ['technology'],
    language: 'en',
    ...changes,
  });

  const fakeSource = {
    sourceId: 'fake',
    fetchLatest: vi.fn<NewsSourceAdapter['fetchLatest']>(),
  };

  let admin: request.Agent;
  let user: request.Agent;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(NEWS_SOURCES)
      .useValue([fakeSource])
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    // The schedule (created on start) would fetch right away: nothing to fetch yet
    fakeSource.fetchLatest.mockResolvedValue([]);
    await app.init();

    prisma = app.get(PrismaService);
    ingestQueue = app.get<Queue>(getQueueToken(INGEST_QUEUE));
    origin = app.get<ConfigService<Env, true>>(ConfigService).get('CORS_ORIGIN', { infer: true });

    user = await signUp('user');
    admin = await signUp('admin');
    await prisma.user.update({ where: { email: emailFor('admin') }, data: { role: 'admin' } });

    // Let the scheduled first fetch finish, so the tests below start with an empty queue
    await vi.waitFor(async () =>
      expect(await ingestQueue.getJobCounts('active', 'waiting')).toEqual({
        active: 0,
        waiting: 0,
      }),
    );
  });

  beforeEach(() => {
    fakeSource.fetchLatest.mockReset();
  });

  afterAll(async () => {
    // New articles are matched against every rule in the database (e.g. the developer's own):
    // remove the notifications they created too
    await prisma.notification.deleteMany({
      where: { articles: { some: { article: { url: { startsWith: urlPrefix } } } } },
    });
    await prisma.article.deleteMany({ where: { url: { startsWith: urlPrefix } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: `e2e-${runId}-` } } });
    await app.close();
  });

  const browser = () => request.agent(app.getHttpServer()).set('Origin', origin);

  async function signUp(name: string) {
    const agent = browser();
    await agent
      .post('/api/auth/sign-up/email')
      .send({
        name: `User ${name}`,
        username: `e2e_${runId}_${name}`,
        email: emailFor(name),
        password: 'secret123',
      })
      .expect(200);
    return agent;
  }

  async function fetchNow() {
    return (await admin.post('/api/admin/news-sources/fetch').expect(202))
      .body as FetchNewsResponse;
  }

  /** Waits until the fetch's job is done, and returns its result. */
  async function finished(batchId: string) {
    return vi.waitFor(
      async () => {
        const job = await ingestQueue.getJob(batchId);
        expect(await job?.getState()).toBe('completed');
        return job!.returnvalue as { newArticles: number };
      },
      { timeout: 10_000, interval: 100 },
    );
  }

  const savedArticles = () =>
    prisma.article.findMany({ where: { url: { startsWith: urlPrefix } }, orderBy: { url: 'asc' } });

  it('is for admins only', async () => {
    await browser().post('/api/admin/news-sources/fetch').expect(401);
    await user.post('/api/admin/news-sources/fetch').expect(403);
    expect(fakeSource.fetchLatest).not.toHaveBeenCalled();
  });

  it('fetches in the background and saves the articles', async () => {
    fakeSource.fetchLatest.mockResolvedValue([
      article('a', { description: 'First', categories: ['technology', 'business'] }),
      article('b'),
    ]);

    const { batchId } = await fetchNow();

    expect(await finished(batchId)).toEqual({ newArticles: 2 });
    const [a, b] = await savedArticles();
    expect(a).toMatchObject({
      sourceId: 'fake',
      externalId: `${runId}-a`,
      title: 'Article a',
      description: 'First',
      sourceName: 'Example',
      categories: ['technology', 'business'],
      publishedAt: new Date('2026-10-19T20:21:00Z'),
    });
    expect(b.title).toBe('Article b');
  });

  it('skips articles it already has (same URL)', async () => {
    fakeSource.fetchLatest.mockResolvedValue([
      // Already saved by the test above, even with another id
      article('a', { externalId: `${runId}-other-id` }),
      article('c'),
    ]);

    const { batchId } = await fetchNow();

    expect(await finished(batchId)).toEqual({ newArticles: 1 });
    expect((await savedArticles()).map((saved) => saved.title)).toEqual([
      'Article a',
      'Article b',
      'Article c',
    ]);
  });

  it('does not queue a second fetch while one is running', async () => {
    // The fetch waits until the test lets it finish
    let finishFetch!: (articles: NormalizedArticle[]) => void;
    fakeSource.fetchLatest.mockImplementation(
      () => new Promise((resolve) => (finishFetch = resolve)),
    );

    const first = await fetchNow();
    await vi.waitFor(() => expect(fakeSource.fetchLatest).toHaveBeenCalled());
    const second = await fetchNow();

    expect(second.batchId).toBe(first.batchId);
    finishFetch([]);
    await finished(first.batchId);
    expect(fakeSource.fetchLatest).toHaveBeenCalledTimes(1);

    // Once it's done, a new fetch can start
    fakeSource.fetchLatest.mockResolvedValue([]);
    const third = await fetchNow();
    expect(third.batchId).not.toBe(first.batchId);
    await finished(third.batchId);
  });
});
