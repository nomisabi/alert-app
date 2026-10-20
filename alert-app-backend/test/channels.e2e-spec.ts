import { CHANNEL_TEST_COOLDOWN_SECONDS, type ChannelList } from '@alert-app/shared';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { subSeconds } from 'date-fns';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import type { Env } from '../src/config/env.js';
import { EmailProvider, type EmailMessage } from '../src/email/email-provider.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { setupApp } from '../src/setup-app.js';

// End-to-end test of the channels endpoints: real app, real database (npm run db:up first).
// The email provider is replaced by a fake, so no real email is sent (.env may hold a Resend key).
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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailProvider)
      .useValue(fakeEmail)
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
});
