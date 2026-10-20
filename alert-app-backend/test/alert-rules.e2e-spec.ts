import {
  ALERT_RULES_PER_USER_MAX,
  APP_CATEGORIES,
  type AlertRule,
  type AlertRuleList,
  type ChannelList,
} from '@alert-app/shared';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import type { Env } from '../src/config/env.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { setupApp } from '../src/setup-app.js';

// End-to-end test of the alert rules and categories endpoints: real app, real database
// (npm run db:up first). Every user of this run is deleted at the end, with their rules and channels.
describe('Alert rules (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let origin: string;

  // Time + random: test files run in parallel and can start in the same millisecond
  const runId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const emailFor = (name: string) => `e2e-${runId}-${name}@example.com`;
  const password = 'secret123';

  const keywordRule = { type: 'keywords', name: 'EV news', keywords: ['electric car', 'Tesla'] };
  const categoryRule = { type: 'category', name: 'Sports', category: 'sports' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    origin = app.get<ConfigService<Env, true>>(ConfigService).get('CORS_ORIGIN', { infer: true });
  });

  afterAll(async () => {
    // onDelete: Cascade also deletes their rules
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

  /** The id of the user's email channel (created at sign-up). */
  async function emailChannelId(agent: request.Agent) {
    return ((await agent.get('/api/channels').expect(200)).body as ChannelList).items[0].id;
  }

  /** Creates a rule that sends to the user's email channel (unless the body has channelIds). */
  async function createRule(agent: request.Agent, body: object = keywordRule) {
    const channelIds = [await emailChannelId(agent)];
    return (
      await agent
        .post('/api/alert-rules')
        .send({ channelIds, ...body })
        .expect(201)
    ).body as AlertRule;
  }

  it('needs a login for every endpoint', async () => {
    const anonymous = browser();
    await anonymous.get('/api/categories').expect(401);
    await anonymous.get('/api/alert-rules').expect(401);
    await anonymous.post('/api/alert-rules').send(keywordRule).expect(401);
    await anonymous.get('/api/alert-rules/some-id').expect(401);
    await anonymous.patch('/api/alert-rules/some-id').send({ enabled: false }).expect(401);
    await anonymous.delete('/api/alert-rules/some-id').expect(401);
  });

  it('lists our categories in display order', async () => {
    const user = await signUp('categories');
    const response = await user.get('/api/categories').expect(200);

    expect(response.body).toEqual({ items: APP_CATEGORIES.map((id) => ({ id })) });
  });

  describe('POST /api/alert-rules', () => {
    it('creates a keyword rule: trimmed, switched on, the other field dropped', async () => {
      const user = await signUp('create');
      const channelId = await emailChannelId(user);
      const response = await user
        .post('/api/alert-rules')
        .send({
          ...keywordRule,
          channelIds: [channelId],
          name: '  EV news ',
          keywords: [' electric car ', 'Tesla'],
          category: 'world',
          userId: 'someone-else',
        })
        .expect(201);

      expect(response.body).toEqual({
        id: expect.any(String) as string,
        name: 'EV news',
        type: 'keywords',
        keywords: ['electric car', 'Tesla'],
        category: null,
        enabled: true,
        channelIds: [channelId],
        createdAt: expect.any(String) as string,
        updatedAt: expect.any(String) as string,
      });
      // Saved for the logged-in user, not the one in the body
      const row = await prisma.alertRule.findUniqueOrThrow({
        where: { id: (response.body as AlertRule).id },
        include: { user: true },
      });
      expect(row.user.email).toBe(emailFor('create'));
    });

    it('creates a category rule, switched off when asked', async () => {
      const user = await signUp('createcat');
      const rule = await createRule(user, { ...categoryRule, keywords: ['x'], enabled: false });

      expect(rule).toMatchObject({
        type: 'category',
        category: 'sports',
        keywords: [],
        enabled: false,
      });
    });

    it('rejects invalid rules with translated field errors', async () => {
      const user = await signUp('invalid');
      const channelIds = [await emailChannelId(user)];
      const errors = async (body: object) =>
        (
          await user
            .post('/api/alert-rules')
            .send({ channelIds, ...body })
            .expect(400)
        ).body as unknown;

      expect(await errors({ name: 'x' })).toEqual({
        code: 'VALIDATION_FAILED',
        message: 'Please check the highlighted fields.',
        fieldErrors: [{ field: 'type', message: 'Choose how this alert finds news.' }],
      });
      expect(await errors({ ...keywordRule, keywords: ['Tesla', 'tesla'] })).toMatchObject({
        fieldErrors: [{ field: 'keywords', message: 'Each keyword can be added only once.' }],
      });
      expect(await errors({ ...categoryRule, category: 'top' })).toMatchObject({
        fieldErrors: [{ field: 'category', message: 'Choose a category.' }],
      });
      expect(
        await prisma.alertRule.count({ where: { user: { email: emailFor('invalid') } } }),
      ).toBe(0);
    });

    it(`allows at most ${ALERT_RULES_PER_USER_MAX} rules per user`, async () => {
      const user = await signUp('limit');
      const { id: userId } = await prisma.user.findUniqueOrThrow({
        where: { email: emailFor('limit') },
      });
      await prisma.alertRule.createMany({
        data: Array.from({ length: ALERT_RULES_PER_USER_MAX - 1 }, (_, i) => ({
          userId,
          name: `Rule ${i}`,
          type: 'category' as const,
          category: 'world',
        })),
      });

      await createRule(user, categoryRule); // the 20th
      const channelIds = [await emailChannelId(user)];
      const response = await user
        .post('/api/alert-rules')
        .send({ ...categoryRule, channelIds })
        .expect(400);
      expect(response.body).toEqual({
        code: 'ALERT_RULE_LIMIT_REACHED',
        message: `You can have at most ${ALERT_RULES_PER_USER_MAX} alerts. Delete one to add another.`,
      });
    });
  });

  describe('GET /api/alert-rules', () => {
    it('lists only my own rules, newest first', async () => {
      const user = await signUp('list');
      const other = await signUp('listother');
      const first = await createRule(user, keywordRule);
      const second = await createRule(user, categoryRule);
      await createRule(other);

      const response = await user.get('/api/alert-rules').expect(200);
      expect((response.body as AlertRuleList).items.map((rule) => rule.id)).toEqual([
        second.id,
        first.id,
      ]);
      expect(response.body).toEqual({ items: [second, first] });
    });

    it('returns a category that is no longer in our list as "other"', async () => {
      const user = await signUp('oldcategory');
      const rule = await createRule(user, categoryRule);
      await prisma.alertRule.update({ where: { id: rule.id }, data: { category: 'removed' } });

      const response = await user.get(`/api/alert-rules/${rule.id}`).expect(200);
      expect((response.body as AlertRule).category).toBe('other');
    });
  });

  describe('PATCH /api/alert-rules/:id', () => {
    it('changes only the fields that are sent', async () => {
      const user = await signUp('toggle');
      const rule = await createRule(user);

      const response = await user
        .patch(`/api/alert-rules/${rule.id}`)
        .send({ enabled: false })
        .expect(200);
      expect(response.body).toEqual({
        ...rule,
        enabled: false,
        updatedAt: expect.any(String) as string,
      });
    });

    it('switches the type and clears the other field', async () => {
      const user = await signUp('switch');
      const rule = await createRule(user, keywordRule);

      const toCategory = await user
        .patch(`/api/alert-rules/${rule.id}`)
        .send({ type: 'category', category: 'technology', name: 'Tech' })
        .expect(200);
      expect(toCategory.body).toMatchObject({
        name: 'Tech',
        type: 'category',
        category: 'technology',
        keywords: [],
      });

      const toKeywords = await user
        .patch(`/api/alert-rules/${rule.id}`)
        .send({ type: 'keywords', keywords: ['chip'] })
        .expect(200);
      expect(toKeywords.body).toMatchObject({
        type: 'keywords',
        keywords: ['chip'],
        category: null,
      });
    });

    it('needs the type together with its field', async () => {
      const user = await signUp('patchinvalid');
      const rule = await createRule(user);

      const noField = await user.patch(`/api/alert-rules/${rule.id}`).send({ type: 'category' });
      expect(noField.status).toBe(400);
      expect(noField.body).toMatchObject({ fieldErrors: [{ field: 'category' }] });

      const noType = await user.patch(`/api/alert-rules/${rule.id}`).send({ keywords: ['chip'] });
      expect(noType.status).toBe(400);
      expect(noType.body).toMatchObject({ fieldErrors: [{ field: 'type' }] });
    });
  });

  describe('DELETE /api/alert-rules/:id', () => {
    it('deletes the rule (204), then it is gone (404)', async () => {
      const user = await signUp('delete');
      const rule = await createRule(user);

      const response = await user.delete(`/api/alert-rules/${rule.id}`).expect(204);
      expect(response.text).toBe('');
      await user.delete(`/api/alert-rules/${rule.id}`).expect(404);
      await user.get(`/api/alert-rules/${rule.id}`).expect(404);
    });
  });

  describe('channels of a rule', () => {
    const invalidChannel = {
      code: 'INVALID_CHANNEL',
      message: 'Choose one of your channels.',
      fieldErrors: [{ field: 'channelIds', message: 'Choose one of your channels.' }],
    };

    it('needs at least one channel, each only once', async () => {
      const user = await signUp('nochannel');
      const channelId = await emailChannelId(user);
      const fieldErrors = async (body: object) =>
        ((await user.post('/api/alert-rules').send(body).expect(400)).body as { fieldErrors: [] })
          .fieldErrors;

      expect(await fieldErrors(categoryRule)).toEqual([
        { field: 'channelIds', message: 'Choose at least one channel.' },
      ]);
      expect(await fieldErrors({ ...categoryRule, channelIds: [] })).toEqual([
        { field: 'channelIds', message: 'Choose at least one channel.' },
      ]);
      expect(await fieldErrors({ ...categoryRule, channelIds: [channelId, channelId] })).toEqual([
        { field: 'channelIds', message: 'Each channel can be chosen only once.' },
      ]);
    });

    it("rejects another user's channel or an unknown id, and saves nothing", async () => {
      const user = await signUp('fch');
      const other = await signUp('fchowner');
      const otherChannelId = await emailChannelId(other);

      for (const channelIds of [[otherChannelId], ['not-a-uuid']]) {
        await user
          .post('/api/alert-rules')
          .send({ ...categoryRule, channelIds })
          .expect(400, invalidChannel);
      }
      expect(await prisma.alertRule.count({ where: { user: { email: emailFor('fch') } } })).toBe(0);

      // The same check when changing a rule; the rule keeps its channels
      const rule = await createRule(user);
      await user
        .patch(`/api/alert-rules/${rule.id}`)
        .send({ channelIds: [otherChannelId] })
        .expect(400, invalidChannel);
      await user.get(`/api/alert-rules/${rule.id}`).expect(200, rule);
    });

    it('replaces the channel list when channelIds is sent, and keeps it otherwise', async () => {
      const user = await signUp('channellist');
      const firstId = await emailChannelId(user);
      // A second channel, so there is something to switch to (Slack comes in milestone 7)
      const { id: userId } = await prisma.user.findUniqueOrThrow({
        where: { email: emailFor('channellist') },
      });
      const { id: secondId } = await prisma.channel.create({ data: { userId, type: 'email' } });
      const rule = await createRule(user);
      expect(rule.channelIds).toEqual([firstId]);

      const replaced = await user
        .patch(`/api/alert-rules/${rule.id}`)
        .send({ channelIds: [secondId] })
        .expect(200);
      expect((replaced.body as AlertRule).channelIds).toEqual([secondId]);

      const toggled = await user
        .patch(`/api/alert-rules/${rule.id}`)
        .send({ enabled: false })
        .expect(200);
      expect((toggled.body as AlertRule).channelIds).toEqual([secondId]);

      // Returned in the order of the channel list (oldest first), not the order they were sent
      const both = await user
        .patch(`/api/alert-rules/${rule.id}`)
        .send({ channelIds: [secondId, firstId] })
        .expect(200);
      expect((both.body as AlertRule).channelIds).toEqual([firstId, secondId]);
    });
  });

  it("treats another user's rule as not found, and leaves it unchanged", async () => {
    const owner = await signUp('owner');
    const intruder = await signUp('intruder');
    const rule = await createRule(owner);
    const notFound = { code: 'ALERT_RULE_NOT_FOUND', message: 'This alert does not exist.' };

    await intruder.get(`/api/alert-rules/${rule.id}`).expect(404, notFound);
    await intruder
      .patch(`/api/alert-rules/${rule.id}`)
      .send({ enabled: false })
      .expect(404, notFound);
    await intruder.delete(`/api/alert-rules/${rule.id}`).expect(404, notFound);
    // The same answer as for an id that doesn't exist (or isn't even a uuid)
    await intruder.get('/api/alert-rules/not-a-uuid').expect(404, notFound);

    await owner.get(`/api/alert-rules/${rule.id}`).expect(200, rule);
  });
});
