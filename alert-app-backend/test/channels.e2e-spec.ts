import {
  CHANNEL_TEST_COOLDOWN_SECONDS,
  type AlertRule,
  type Channel,
  type ChannelList,
} from '@alert-app/shared';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { subSeconds } from 'date-fns';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import type { SlackPayload } from '../src/channels/slack/slack-messages.js';
import { SlackWebhookClient } from '../src/channels/slack/slack-webhook-client.js';
import type { Env } from '../src/config/env.js';
import { EmailProvider, type EmailMessage } from '../src/email/email-provider.js';
import { PermanentSendError } from '../src/errors/permanent-send-error.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { setupApp } from '../src/setup-app.js';

// End-to-end test of the channels endpoints: real app, real database (npm run db:up first).
// The email provider and the Slack client are replaced by fakes, so no real email or Slack message
// is sent (.env may hold a Resend key).
describe('Channels (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let origin: string;

  // Time + random: test files run in parallel and can start in the same millisecond
  const runId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const emailFor = (name: string) => `e2e-${runId}-${name}@example.com`;
  const password = 'secret123';

  /** Records the emails instead of sending them. */
  const fakeEmail = { send: vi.fn<(message: EmailMessage) => Promise<void>>() };
  /** Records the Slack posts instead of sending them. */
  const fakeSlack = { post: vi.fn<(webhookUrl: string, payload: SlackPayload) => Promise<void>>() };
  /** A webhook URL in Slack's format (never a real one). */
  const webhookUrlFor = (name: string) =>
    `https://hooks.slack.com/services/T${runId}/B${name}/secret${name}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailProvider)
      .useValue(fakeEmail)
      .overrideProvider(SlackWebhookClient)
      .useValue(fakeSlack)
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    origin = app.get<ConfigService<Env, true>>(ConfigService).get('CORS_ORIGIN', { infer: true });
  });

  beforeEach(() => {
    fakeEmail.send.mockReset();
    fakeEmail.send.mockResolvedValue(undefined);
    fakeSlack.post.mockReset();
    fakeSlack.post.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    // onDelete: Cascade also deletes their channels
    await prisma.user.deleteMany({ where: { email: { startsWith: `e2e-${runId}-` } } });
    await app.close();
  });

  /** A client that keeps cookies between requests, like a browser. */
  const browser = () => request.agent(app.getHttpServer()).set('Origin', origin);

  async function signUp(name: string) {
    const agent = browser();
    await agent
      .post('/api/auth/sign-up/email')
      .send({
        name: `User ${name}`,
        username: `e2e_${runId}_${name}`,
        email: emailFor(name),
        password,
      })
      .expect(200);
    return agent;
  }

  async function channels(agent: request.Agent) {
    return ((await agent.get('/api/channels').expect(200)).body as ChannelList).items;
  }

  const lastTestSentAt = async (id: string) =>
    (await prisma.channel.findUniqueOrThrow({ where: { id } })).lastTestSentAt;

  it('needs a login', async () => {
    const anonymous = browser();
    await anonymous.get('/api/channels').expect(401);
    await anonymous.post('/api/channels/some-id/test').expect(401);
  });

  it('gives every new user one email channel to their account email', async () => {
    const user = await signUp('list');

    expect(await channels(user)).toEqual([
      { id: expect.any(String) as string, type: 'email', destination: emailFor('list') },
    ]);
  });

  describe('POST /api/channels/:id/test', () => {
    it('sends a test email to the account email (204)', async () => {
      const user = await signUp('send');
      const [channel] = await channels(user);

      const response = await user.post(`/api/channels/${channel.id}/test`).expect(204);
      expect(response.text).toBe('');
      expect(fakeEmail.send).toHaveBeenCalledOnce();
      expect(fakeEmail.send.mock.calls[0][0]).toMatchObject({
        to: emailFor('send'),
        subject: 'Your Alert App email channel works',
        text: expect.stringContaining(`Hi User send,`) as string,
      });
    });

    it('allows one test per minute (429 with Retry-After), then sends again', async () => {
      const user = await signUp('cooldown');
      const [channel] = await channels(user);
      await user.post(`/api/channels/${channel.id}/test`).expect(204);

      const tooSoon = await user.post(`/api/channels/${channel.id}/test`).expect(429);
      const seconds = Number(tooSoon.headers['retry-after']);
      expect(seconds).toBeGreaterThan(0);
      expect(seconds).toBeLessThanOrEqual(CHANNEL_TEST_COOLDOWN_SECONDS);
      expect(tooSoon.body).toEqual({
        code: 'CHANNEL_TEST_TOO_SOON',
        message: `You can send one test message per minute. Please try again in ${seconds} seconds.`,
      });
      expect(fakeEmail.send).toHaveBeenCalledOnce();

      // A minute later (moved back in the database instead of waiting)
      await prisma.channel.update({
        where: { id: channel.id },
        data: { lastTestSentAt: subSeconds(new Date(), CHANNEL_TEST_COOLDOWN_SECONDS) },
      });
      await user.post(`/api/channels/${channel.id}/test`).expect(204);
      expect(fakeEmail.send).toHaveBeenCalledTimes(2);
    });

    it("treats another user's channel and unknown ids as not found, and leaves them unchanged", async () => {
      const owner = await signUp('owner');
      const intruder = await signUp('intruder');
      const [channel] = await channels(owner);
      const notFound = { code: 'CHANNEL_NOT_FOUND', message: 'This channel does not exist.' };

      await intruder.post(`/api/channels/${channel.id}/test`).expect(404, notFound);
      await intruder.post('/api/channels/not-a-uuid/test').expect(404, notFound);

      expect(fakeEmail.send).not.toHaveBeenCalled();
      expect(await lastTestSentAt(channel.id)).toBeNull();
      expect(await channels(intruder)).not.toContainEqual(channel);
    });

    it('answers 502 when the email service fails, without its details', async () => {
      // The failure is logged; keep the test output clean
      const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
      fakeEmail.send.mockRejectedValue(new Error('Resend: secret provider details'));
      const user = await signUp('fails');
      const [channel] = await channels(user);

      const response = await user.post(`/api/channels/${channel.id}/test`).expect(502);
      expect(response.body).toEqual({
        code: 'CHANNEL_TEST_FAILED',
        message: "We couldn't send the test message. Please try again later.",
      });
      expect(JSON.stringify(response.body)).not.toContain('secret');
      expect(logError).toHaveBeenCalled();
      // A failed send counts too, so a broken setup can't use up the quota by retrying
      expect(await lastTestSentAt(channel.id)).not.toBeNull();

      logError.mockRestore();
    });
  });
  describe('POST /api/channels (connect Slack)', () => {
    /** The stored config of a channel (the API never returns the URL). */
    const storedConfig = async (id: string) =>
      (await prisma.channel.findUniqueOrThrow({ where: { id } })).config;

    const connect = (agent: request.Agent, name: string, body: object = {}) =>
      agent
        .post('/api/channels')
        .send({ type: 'slack', name: '#news in Acme', webhookUrl: webhookUrlFor(name), ...body });

    it('needs a login', async () => {
      await connect(browser(), 'anonymous').expect(401);
      await browser().patch('/api/channels/some-id').send({ name: 'x' }).expect(401);
    });

    it('checks the webhook with the test message, then saves it (201, without the URL)', async () => {
      const user = await signUp('slack');

      const response = await connect(user, 'slack', { name: ' #news in Acme ' }).expect(201);

      const channel = response.body as Channel;
      expect(channel).toEqual({
        id: expect.any(String) as string,
        type: 'slack',
        destination: '#news in Acme',
      });
      // The URL is a secret: it never comes back
      expect(JSON.stringify(response.body)).not.toContain('secret');
      expect(fakeSlack.post).toHaveBeenCalledOnce();
      expect(fakeSlack.post).toHaveBeenCalledWith(
        webhookUrlFor('slack'),
        expect.objectContaining({ text: 'Alert App is connected' }),
      );
      expect(await storedConfig(channel.id)).toEqual({
        name: '#news in Acme',
        webhookUrl: webhookUrlFor('slack'),
      });
      expect(await lastTestSentAt(channel.id)).not.toBeNull();
      // Email first (oldest), then Slack
      expect((await channels(user)).map((item) => item.type)).toEqual(['email', 'slack']);
    });

    it('allows one Slack channel per user (409)', async () => {
      const user = await signUp('twice');
      await connect(user, 'twice').expect(201);
      fakeSlack.post.mockClear();

      await connect(user, 'twice2').expect(409, {
        code: 'SLACK_ALREADY_CONNECTED',
        message: "You've already connected Slack.",
      });
      expect(fakeSlack.post).not.toHaveBeenCalled();
    });

    it('accepts only Slack webhook URLs, and never posts to other ones (400)', async () => {
      const user = await signUp('badurl');

      const response = await connect(user, 'badurl', {
        webhookUrl: 'http://localhost:3000/api/admin/news-sources/fetch',
        name: '',
      }).expect(400);
      expect(response.body).toEqual({
        code: 'VALIDATION_FAILED',
        message: 'Please check the highlighted fields.',
        fieldErrors: [
          { field: 'name', message: 'Enter a name for this channel.' },
          {
            field: 'webhookUrl',
            message: 'Paste a Slack webhook URL. It starts with https://hooks.slack.com/services/',
          },
        ],
      });
      // Only Slack can be created: every user already has their email channel
      await user.post('/api/channels').send({ type: 'email' }).expect(400);
      expect(fakeSlack.post).not.toHaveBeenCalled();
      expect(await channels(user)).toHaveLength(1);
    });

    it('saves nothing when Slack refuses the webhook (400 on the URL field)', async () => {
      const logWarn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
      fakeSlack.post.mockRejectedValue(new PermanentSendError('Slack: 404 no_service'));
      const user = await signUp('refused');
      const message =
        "Slack didn't accept this webhook. Check that you copied the whole URL and that the webhook still exists.";

      await connect(user, 'refused').expect(400, {
        code: 'SLACK_WEBHOOK_INVALID',
        message,
        fieldErrors: [{ field: 'webhookUrl', message }],
      });
      expect(await channels(user)).toHaveLength(1);
      logWarn.mockRestore();
    });

    it('saves nothing when Slack fails or does not answer (502)', async () => {
      const logWarn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
      fakeSlack.post.mockRejectedValue(new Error('Slack: 503'));
      const user = await signUp('slackdown');

      await connect(user, 'slackdown').expect(502);
      expect(await channels(user)).toHaveLength(1);
      logWarn.mockRestore();
    });

    it('never returns the webhook URL in the channel list', async () => {
      const user = await signUp('listurl');
      await connect(user, 'listurl').expect(201);

      const response = await user.get('/api/channels').expect(200);
      expect(JSON.stringify(response.body)).not.toContain('secret');
    });

    it('sends "Send test message" to the stored webhook (connecting counted as a test)', async () => {
      const user = await signUp('slacktest');
      const slack = (await connect(user, 'slacktest').expect(201)).body as Channel;
      fakeSlack.post.mockClear();

      // Connecting sent the test message a moment ago: the one-per-minute limit applies
      await user.post(`/api/channels/${slack.id}/test`).expect(429);
      expect(fakeSlack.post).not.toHaveBeenCalled();

      // A minute later (moved back in the database instead of waiting)
      await prisma.channel.update({
        where: { id: slack.id },
        data: { lastTestSentAt: subSeconds(new Date(), CHANNEL_TEST_COOLDOWN_SECONDS) },
      });
      await user.post(`/api/channels/${slack.id}/test`).expect(204);
      expect(fakeSlack.post).toHaveBeenCalledWith(
        webhookUrlFor('slacktest'),
        expect.objectContaining({ text: 'Alert App is connected' }),
      );
    });

    it('answers 502 when Slack refuses the test message later (e.g. the webhook was removed)', async () => {
      const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
      const user = await signUp('removed');
      const slack = (await connect(user, 'removed').expect(201)).body as Channel;
      await prisma.channel.update({ where: { id: slack.id }, data: { lastTestSentAt: null } });
      fakeSlack.post.mockRejectedValue(new PermanentSendError('Slack: 404 no_service'));

      const response = await user.post(`/api/channels/${slack.id}/test`).expect(502);
      expect((response.body as { code: string }).code).toBe('CHANNEL_TEST_FAILED');
      logError.mockRestore();
    });

    it('can be chosen in "Send to" of an alert rule', async () => {
      const user = await signUp('ruleslack');
      const slack = (await connect(user, 'ruleslack').expect(201)).body as Channel;
      const [email] = await channels(user);

      const rule = await user
        .post('/api/alert-rules')
        .send({
          type: 'keywords',
          name: 'EV news',
          keywords: ['tesla'],
          channelIds: [email.id, slack.id],
        })
        .expect(201);
      expect((rule.body as AlertRule).channelIds).toEqual([email.id, slack.id]);
    });
  });

  describe('PATCH /api/channels/:id (edit Slack)', () => {
    const storedConfig = async (id: string) =>
      (await prisma.channel.findUniqueOrThrow({ where: { id } })).config;

    async function connectedUser(name: string) {
      const user = await signUp(name);
      const slack = (
        await user
          .post('/api/channels')
          .send({ type: 'slack', name: '#news', webhookUrl: webhookUrlFor(name) })
          .expect(201)
      ).body as Channel;
      fakeSlack.post.mockClear();
      return { user, slack };
    }

    it('changes only the name without contacting Slack', async () => {
      const { user, slack } = await connectedUser('rename');
      const testedAt = await lastTestSentAt(slack.id);

      const response = await user
        .patch(`/api/channels/${slack.id}`)
        .send({ name: '#alerts' })
        .expect(200);

      expect(response.body).toEqual({ ...slack, destination: '#alerts' });
      expect(fakeSlack.post).not.toHaveBeenCalled();
      expect(await storedConfig(slack.id)).toEqual({
        name: '#alerts',
        webhookUrl: webhookUrlFor('rename'),
      });
      expect(await lastTestSentAt(slack.id)).toEqual(testedAt);
    });

    it('checks a new webhook URL with the test message before saving it', async () => {
      const { user, slack } = await connectedUser('newurl');

      await user
        .patch(`/api/channels/${slack.id}`)
        .send({ webhookUrl: webhookUrlFor('newurl2') })
        .expect(200, { ...slack });

      expect(fakeSlack.post).toHaveBeenCalledOnce();
      expect(fakeSlack.post.mock.calls[0][0]).toBe(webhookUrlFor('newurl2'));
      expect(await storedConfig(slack.id)).toEqual({
        name: '#news',
        webhookUrl: webhookUrlFor('newurl2'),
      });
    });

    it('keeps the old settings when Slack refuses the new URL', async () => {
      const logWarn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
      const { user, slack } = await connectedUser('badnew');
      fakeSlack.post.mockRejectedValue(new PermanentSendError('Slack: 404 no_service'));

      const response = await user
        .patch(`/api/channels/${slack.id}`)
        .send({ name: '#renamed', webhookUrl: webhookUrlFor('badnew2') })
        .expect(400);

      expect((response.body as { code: string }).code).toBe('SLACK_WEBHOOK_INVALID');
      // Nothing changed, not even the name
      expect(await storedConfig(slack.id)).toEqual({
        name: '#news',
        webhookUrl: webhookUrlFor('badnew'),
      });
      logWarn.mockRestore();
    });

    it('validates the fields like connecting (400)', async () => {
      const { user, slack } = await connectedUser('patchbad');

      const response = await user
        .patch(`/api/channels/${slack.id}`)
        .send({ name: '', webhookUrl: 'https://example.com/services/T0/B0/X0' })
        .expect(400);

      expect((response.body as { fieldErrors: { field: string }[] }).fieldErrors).toEqual([
        expect.objectContaining({ field: 'name' }),
        expect.objectContaining({ field: 'webhookUrl' }),
      ]);
      expect(fakeSlack.post).not.toHaveBeenCalled();
    });

    it('does not contact Slack when nothing changes (empty body, or the same URL again)', async () => {
      const { user, slack } = await connectedUser('nochange');

      await user
        .patch(`/api/channels/${slack.id}`)
        .send({})
        .expect(200, { ...slack });
      await user
        .patch(`/api/channels/${slack.id}`)
        .send({ webhookUrl: webhookUrlFor('nochange') })
        .expect(200, { ...slack });

      expect(fakeSlack.post).not.toHaveBeenCalled();
    });

    it("can't edit the email channel (400), another user's channel or an unknown id (404)", async () => {
      const { user, slack } = await connectedUser('patchowner');
      const intruder = await signUp('patchintruder');
      const [email] = await channels(user);
      const notFound = { code: 'CHANNEL_NOT_FOUND', message: 'This channel does not exist.' };

      await user.patch(`/api/channels/${email.id}`).send({ name: 'x' }).expect(400, {
        code: 'CHANNEL_NOT_EDITABLE',
        message: "This channel can't be edited.",
      });
      await intruder.patch(`/api/channels/${slack.id}`).send({ name: 'x' }).expect(404, notFound);
      await intruder.patch('/api/channels/not-a-uuid').send({ name: 'x' }).expect(404, notFound);

      expect(await storedConfig(slack.id)).toMatchObject({ name: '#news' });
    });
  });
});
