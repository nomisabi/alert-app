import type { AlertRule, ChannelList, FetchNewsResponse } from '@alert-app/shared';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import type { Env } from '../src/config/env.js';
import { MatchService, type MatchJobData } from '../src/matching/match.service.js';
import {
  NEWS_SOURCES,
  type NewsSourceAdapter,
  type NormalizedArticle,
} from '../src/news-sources/news-source-adapter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { INGEST_QUEUE, MATCH_QUEUE } from '../src/queues/queues.js';
import { setupApp } from '../src/setup-app.js';

// End-to-end test of matching: a fetch (fake news source) → match job → pending notifications.
// Real app, database and Redis (npm run db:up first), own queues (test/setup-e2e.ts).
describe('Matching (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let matchQueue: Queue<MatchJobData>;
  let ingestQueue: Queue;
  /** The match job data of the first test, for the retry test */
  let firstMatch: MatchJobData;
  let origin: string;

  const runId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const emailFor = (name: string) => `e2e-${runId}-${name}@example.com`;
  const urlPrefix = `https://example.com/e2e-${runId}/`;

  const article = (name: string, changes: Partial<NormalizedArticle>): NormalizedArticle => ({
    sourceId: 'fake',
    externalId: `${runId}-${name}`,
    url: `${urlPrefix}${name}`,
    title: '',
    description: null,
    imageUrl: null,
    sourceName: 'Example',
    publishedAt: new Date('2026-10-19T20:21:00Z'),
    categories: ['other'],
    language: 'en',
    ...changes,
  });

  const fakeSource = { sourceId: 'fake', fetchLatest: vi.fn<NewsSourceAdapter['fetchLatest']>() };

  let admin: request.Agent;
  /** Rules by name */
  const rules: Record<string, AlertRule> = {};

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(NEWS_SOURCES)
      .useValue([fakeSource])
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    // The schedule fetches once on start: nothing yet
    fakeSource.fetchLatest.mockResolvedValue([]);
    await app.init();

    prisma = app.get(PrismaService);
    matchQueue = app.get<Queue<MatchJobData>>(getQueueToken(MATCH_QUEUE));
    ingestQueue = app.get<Queue>(getQueueToken(INGEST_QUEUE));
    origin = app.get<ConfigService<Env, true>>(ConfigService).get('CORS_ORIGIN', { infer: true });

    admin = await signUp('admin');
    await prisma.user.update({ where: { email: emailFor('admin') }, data: { role: 'admin' } });

    // Ann sends to email and Slack, so every rule of hers has two channels. (Slack only goes to
    // the log here: test/setup-e2e.ts sets SLACK_ENABLED=false.)
    const ann = await signUp('ann');
    await ann
      .post('/api/channels')
      .send({
        type: 'slack',
        name: '#ann',
        webhookUrl: `https://hooks.slack.com/services/T${runId}/Bann/secretann`,
      })
      .expect(201);
    await createRule(ann, { name: 'EV', type: 'keywords', keywords: ['electric car', 'Tesla'] });
    await createRule(ann, { name: 'Sports', type: 'category', category: 'sports' });
    await createRule(ann, { name: 'Off', type: 'keywords', keywords: ['Tesla'], enabled: false });

    // A disabled user's rules are skipped
    const bob = await signUp('bob');
    await createRule(bob, { name: 'Bob tech', type: 'category', category: 'technology' });
    await prisma.user.update({ where: { email: emailFor('bob') }, data: { banned: true } });
  });

  afterAll(async () => {
    // Also removes the notifications this test's articles created for other rules in the
    // database (e.g. the developer's own rules)
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

  async function createRule(agent: request.Agent, body: Record<string, unknown>) {
    const channels = (await agent.get('/api/channels').expect(200)).body as ChannelList;
    const channelIds = channels.items.map((channel) => channel.id);
    const rule = (
      await agent
        .post('/api/alert-rules')
        .send({ ...body, channelIds })
        .expect(201)
    ).body as AlertRule;
    rules[rule.name] = rule;
  }

  /** Waits until the match job of a fetch is done. */
  async function matched(batchId: string) {
    return vi.waitFor(
      async () => {
        const jobs = await matchQueue.getJobs(['completed']);
        const job = jobs.find((candidate) => candidate.data.batchId === batchId);
        expect(job).toBeDefined();
        return job!;
      },
      { timeout: 10_000, interval: 100 },
    );
  }

  /** The notifications of a rule, with the URLs of their articles. */
  const notificationsOf = (ruleName: string) =>
    prisma.notification.findMany({
      where: { alertRuleId: rules[ruleName].id },
      include: { articles: { select: { article: { select: { url: true } } } } },
    });

  it('creates a notification per matching rule and channel, with its articles', async () => {
    fakeSource.fetchLatest.mockResolvedValue([
      article('tesla', {
        title: 'Tesla unveils a cheaper model',
        description: 'The electric-car maker says…',
        categories: ['technology'],
      }),
      article('match', { title: 'Late goal decides the final', categories: ['sports'] }),
      article('quiet', { title: 'Nothing to see here', categories: ['business'] }),
    ]);

    const { batchId } = (await admin.post('/api/admin/news-sources/fetch').expect(202))
      .body as FetchNewsResponse;
    const job = await matched(batchId);
    expect(job.data.articleIds).toHaveLength(3);
    firstMatch = job.data;

    // One notification per channel of the rule (email and Slack), each with the same articles
    const ev = await notificationsOf('EV');
    expect(rules.EV.channelIds).toHaveLength(2);
    expect(ev.map((notification) => notification.channelId).sort()).toEqual(
      [...rules.EV.channelIds].sort(),
    );
    for (const notification of ev) {
      expect(notification.batchId).toBe(batchId);
      // Created as pending; the notify job may already have sent it (to the log) by now
      expect(['pending', 'sent']).toContain(notification.status);
      expect(notification.articles.map(({ article: { url } }) => url)).toEqual([
        `${urlPrefix}tesla`,
      ]);
    }

    const sports = await notificationsOf('Sports');
    expect(sports).toHaveLength(2);
    for (const notification of sports) {
      expect(notification.articles.map(({ article: { url } }) => url)).toEqual([
        `${urlPrefix}match`,
      ]);
    }

    // Switched off (it sends to email and Slack too), or the user is disabled: nothing on any channel
    expect(rules.Off.channelIds).toHaveLength(2);
    expect(await notificationsOf('Off')).toEqual([]);
    expect(await notificationsOf('Bob tech')).toEqual([]);
  });

  it('creates nothing new when the same batch is matched again (a retry)', async () => {
    const counts = async (batchId: string) => ({
      notifications: await prisma.notification.count({ where: { batchId } }),
      articles: await prisma.notificationArticle.count({ where: { notification: { batchId } } }),
    });
    const before = await counts(firstMatch.batchId);

    const ids = await app.get(MatchService).match(firstMatch);

    expect(ids).toHaveLength(before.notifications);
    expect(await counts(firstMatch.batchId)).toEqual(before);
  });

  it('queues no match job when a fetch saves nothing new', async () => {
    // The same articles again: all known
    const { batchId } = (await admin.post('/api/admin/news-sources/fetch').expect(202))
      .body as FetchNewsResponse;

    await vi.waitFor(
      async () => expect(await (await ingestQueue.getJob(batchId))?.getState()).toBe('completed'),
      { timeout: 10_000, interval: 100 },
    );
    const jobs = await matchQueue.getJobs(['waiting', 'active', 'delayed', 'completed', 'failed']);
    expect(jobs.some((candidate) => candidate.data.batchId === batchId)).toBe(false);
  });
});
