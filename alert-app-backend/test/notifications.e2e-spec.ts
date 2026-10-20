import type { AlertRule, Channel, ChannelList, FetchNewsResponse } from '@alert-app/shared';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import type { SlackPayload } from '../src/channels/slack/slack-messages.js';
import { SlackWebhookClient } from '../src/channels/slack/slack-webhook-client.js';
import type { Env } from '../src/config/env.js';
import { EmailProvider, type EmailMessage } from '../src/email/email-provider.js';
import { PermanentSendError } from '../src/errors/permanent-send-error.js';
import {
  NEWS_SOURCES,
  type NewsSourceAdapter,
  type NormalizedArticle,
} from '../src/news-sources/news-source-adapter.js';
import { NotifyService } from '../src/notifications/notify.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { NOTIFY_QUEUE } from '../src/queues/queues.js';
import { setupApp } from '../src/setup-app.js';

// End-to-end test of sending alerts: fetch (fake news source) → match → notify → email or Slack
// (fakes). Real app, database and Redis (npm run db:up first), own queues (test/setup-e2e.ts).
describe('Notifications (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let origin: string;

  const runId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const emailFor = (name: string) => `e2e-${runId}-${name}@example.com`;
  const urlPrefix = `https://example.com/e2e-${runId}/`;

  const article = (name: string, title: string): NormalizedArticle => ({
    sourceId: 'fake',
    externalId: `${runId}-${name}`,
    url: `${urlPrefix}${name}`,
    title,
    description: `About ${name}`,
    imageUrl: null,
    sourceName: 'Example News',
    publishedAt: new Date('2026-10-19T20:21:00Z'),
    categories: ['technology'],
    language: 'en',
  });

  const fakeSource = { sourceId: 'fake', fetchLatest: vi.fn<NewsSourceAdapter['fetchLatest']>() };
  /** Records the emails instead of sending them */
  const fakeEmail = { send: vi.fn<(message: EmailMessage) => Promise<void>>() };
  /** Records the Slack posts instead of sending them */
  const fakeSlack = { post: vi.fn<(webhookUrl: string, payload: SlackPayload) => Promise<void>>() };

  let admin: request.Agent;
  let rule: AlertRule;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(NEWS_SOURCES)
      .useValue([fakeSource])
      .overrideProvider(EmailProvider)
      .useValue(fakeEmail)
      .overrideProvider(SlackWebhookClient)
      .useValue(fakeSlack)
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    fakeSource.fetchLatest.mockResolvedValue([]);
    await app.init();

    prisma = app.get(PrismaService);
    origin = app.get<ConfigService<Env, true>>(ConfigService).get('CORS_ORIGIN', { infer: true });

    admin = await signUp('admin');
    await prisma.user.update({ where: { email: emailFor('admin') }, data: { role: 'admin' } });

    // The keyword is this run's id, so only this test's articles match (not the developer's)
    const ann = await signUp('ann');
    const channels = (await ann.get('/api/channels').expect(200)).body as ChannelList;
    rule = (
      await ann
        .post('/api/alert-rules')
        .send({
          name: 'Run news',
          type: 'keywords',
          keywords: [runId],
          channelIds: channels.items.map((channel) => channel.id),
        })
        .expect(201)
    ).body as AlertRule;
  });

  beforeEach(() => {
    fakeEmail.send.mockReset();
    fakeEmail.send.mockResolvedValue(undefined);
    fakeSlack.post.mockReset();
    fakeSlack.post.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    // Also the notifications of other rules in the database for this test's articles
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

  /** Waits until the rule's notification of a fetch has one of the states. */
  const notificationOf = (
    batchId: string,
    matches: (status: string, attempts: number) => boolean,
    alertRuleId = rule.id,
  ) =>
    vi.waitFor(
      async () => {
        const notification = await prisma.notification.findFirst({
          where: { batchId, alertRuleId },
        });
        expect(notification).not.toBeNull();
        expect(matches(notification!.status, notification!.attempts)).toBe(true);
        return notification!;
      },
      { timeout: 10_000, interval: 100 },
    );

  it('sends one email per rule with its new articles, and marks the notification sent', async () => {
    fakeSource.fetchLatest.mockResolvedValue([
      article('first', `First ${runId} story`),
      article('second', `Second ${runId} story`),
      article('other', 'Something else'),
    ]);

    const { batchId } = await fetchNow();
    const notification = await notificationOf(batchId, (status) => status === 'sent');

    expect(notification).toMatchObject({ attempts: 1, error: null });
    expect(notification.sentAt).toBeInstanceOf(Date);

    const emails = fakeEmail.send.mock.calls
      .map(([message]) => message)
      .filter((message) => message.to === emailFor('ann'));
    expect(emails).toHaveLength(1);
    expect(emails[0].subject).toBe('2 new articles for your alert “Run news”');
    expect(emails[0].text).toContain(`First ${runId} story`);
    expect(emails[0].text).toContain(`Second ${runId} story`);
    expect(emails[0].text).not.toContain('Something else');
    expect(emails[0].text).toContain(`${origin}/alerts`);
  });

  it('posts the alert to Slack for a rule that sends there', async () => {
    const webhookUrl = `https://hooks.slack.com/services/T${runId}/Bbob/secretbob`;
    const keyword = `slack${runId}`;
    const bob = await signUp('bob');
    const slack = (
      await bob.post('/api/channels').send({ type: 'slack', name: '#news', webhookUrl }).expect(201)
    ).body as Channel;
    const slackRule = (
      await bob
        .post('/api/alert-rules')
        .send({ name: 'Bob news', type: 'keywords', keywords: [keyword], channelIds: [slack.id] })
        .expect(201)
    ).body as AlertRule;
    fakeSlack.post.mockClear();
    fakeSource.fetchLatest.mockResolvedValue([article('slack', `Big ${keyword} story`)]);

    const { batchId } = await fetchNow();
    const notification = await notificationOf(batchId, (status) => status === 'sent', slackRule.id);

    expect(notification.channelId).toBe(slack.id);
    const posts = fakeSlack.post.mock.calls.filter(([url]) => url === webhookUrl);
    expect(posts).toHaveLength(1);
    const [, payload] = posts[0];
    expect(payload.text).toBe('New article for your alert “Bob news”');
    expect(JSON.stringify(payload.blocks)).toContain(`|Big ${keyword} story>`);
    // Bob's rule only sends to Slack: no email for Bob
    expect(fakeEmail.send.mock.calls.map(([message]) => message.to)).not.toContain(emailFor('bob'));
  });

  it('still sends the email when Slack fails for good (each channel is sent on its own)', async () => {
    const webhookUrl = `https://hooks.slack.com/services/T${runId}/Bcarol/secretcarol`;
    const keyword = `both${runId}`;
    const carol = await signUp('carol');
    await carol
      .post('/api/channels')
      .send({ type: 'slack', name: '#news', webhookUrl })
      .expect(201);
    const channels = (await carol.get('/api/channels').expect(200)).body as ChannelList;
    const [email, slack] = channels.items;
    const bothRule = (
      await carol
        .post('/api/alert-rules')
        .send({
          name: 'Carol news',
          type: 'keywords',
          keywords: [keyword],
          channelIds: [email.id, slack.id],
        })
        .expect(201)
    ).body as AlertRule;
    // The webhook was removed in Slack after connecting
    fakeSlack.post.mockImplementation((url) =>
      url === webhookUrl
        ? Promise.reject(new PermanentSendError('Slack: 404 no_service'))
        : Promise.resolve(),
    );
    fakeSource.fetchLatest.mockResolvedValue([article('both', `Big ${keyword} story`)]);

    const { batchId } = await fetchNow();
    const notifications = await vi.waitFor(
      async () => {
        const found = await prisma.notification.findMany({
          where: { batchId, alertRuleId: bothRule.id },
        });
        expect(found.map(({ status }) => status).sort()).toEqual(['failed', 'sent']);
        return found;
      },
      { timeout: 10_000, interval: 100 },
    );

    // Slack: failed after one attempt (no retries), with Slack's answer as the error
    expect(notifications.find(({ channelId }) => channelId === slack.id)).toMatchObject({
      status: 'failed',
      attempts: 1,
      error: 'Slack: 404 no_service',
    });
    // Email: sent anyway
    expect(notifications.find(({ channelId }) => channelId === email.id)).toMatchObject({
      status: 'sent',
      error: null,
    });
    expect(fakeEmail.send.mock.calls.map(([message]) => message.to)).toContain(emailFor('carol'));
  });

  it('saves the error and tries again; failed after the last attempt', async () => {
    fakeEmail.send.mockRejectedValue(new Error('Resend is down'));
    fakeSource.fetchLatest.mockResolvedValue([article('third', `Third ${runId} story`)]);

    const { batchId } = await fetchNow();
    // The first attempt failed: still pending, BullMQ tries again in 30 seconds
    const notification = await notificationOf(
      batchId,
      (status, attempts) => status === 'pending' && attempts === 1,
    );
    expect(notification).toMatchObject({ error: 'Resend is down', sentAt: null });

    // The last attempt (without waiting for BullMQ's retry)
    await expect(app.get(NotifyService).send(notification.id, 3, 3)).rejects.toThrow(
      'Resend is down',
    );
    expect(
      await prisma.notification.findUniqueOrThrow({ where: { id: notification.id } }),
    ).toMatchObject({ status: 'failed', attempts: 2, error: 'Resend is down', sentAt: null });
  });

  it('does not retry when the provider refuses the email for good (e.g. an invalid address)', async () => {
    fakeEmail.send.mockRejectedValue(
      new PermanentSendError('Resend: validation_error: Invalid `to`'),
    );
    fakeSource.fetchLatest.mockResolvedValue([article('fourth', `Fourth ${runId} story`)]);

    const { batchId } = await fetchNow();
    // Failed after the first attempt, without waiting for retries
    const notification = await notificationOf(batchId, (status) => status === 'failed');

    expect(notification).toMatchObject({
      attempts: 1,
      error: 'Resend: validation_error: Invalid `to`',
      sentAt: null,
    });
    // BullMQ also gave up: the job failed after one attempt
    const job = await app.get<Queue>(getQueueToken(NOTIFY_QUEUE)).getJob(notification.id);
    expect(await job?.getState()).toBe('failed');
    expect(job?.attemptsMade).toBe(1);
  });

  it('does not send a notification twice', async () => {
    const [sent] = await prisma.notification.findMany({
      where: { alertRuleId: rule.id, status: 'sent' },
    });

    await app.get(NotifyService).send(sent.id, 1, 3);

    expect(fakeEmail.send).not.toHaveBeenCalled();
  });

  it('queues each notification only once (e.g. when a match job runs again)', async () => {
    const notifyQueue = app.get<Queue>(getQueueToken(NOTIFY_QUEUE));
    const [sent] = await prisma.notification.findMany({
      where: { alertRuleId: rule.id, status: 'sent' },
    });
    const jobsOf = async () =>
      (await notifyQueue.getJobs(['waiting', 'active', 'delayed', 'completed', 'failed'])).filter(
        (job) => job.id === sent.id,
      );
    expect(await jobsOf()).toHaveLength(1);

    await app.get(NotifyService).enqueue([sent.id]);

    expect(await jobsOf()).toHaveLength(1);
  });

  it('sends nothing when the rule was deleted before sending', async () => {
    const { userId } = await prisma.alertRule.findUniqueOrThrow({ where: { id: rule.id } });
    const deleted = await prisma.alertRule.create({
      data: { userId, name: 'Deleted soon', type: 'keywords', keywords: ['x'] },
    });
    const notification = await prisma.notification.create({
      data: { batchId: `${runId}-deleted`, alertRuleId: deleted.id, channelId: rule.channelIds[0] },
    });
    // Deleting the rule also deletes its notifications
    await prisma.alertRule.delete({ where: { id: deleted.id } });

    await app.get(NotifyService).send(notification.id, 1, 3);

    expect(fakeEmail.send).not.toHaveBeenCalled();
  });
});
