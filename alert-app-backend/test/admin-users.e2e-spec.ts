import type { AdminUser, AdminUserList } from '@alert-app/shared';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import type { Env } from '../src/config/env.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { setupApp } from '../src/setup-app.js';

// End-to-end test of the admin users endpoints: real app, real database (npm run db:up first).
// The database may hold other users, so lists are always filtered by this run's id.
describe('Admin users (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let origin: string;

  const runId = Date.now().toString(36);
  const emailFor = (name: string) => `e2e-${runId}-${name}@example.com`;
  const usernameFor = (name: string) => `e2e_${runId}_${name}`;
  const password = 'secret123';

  let admin: request.Agent;
  let adminId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    origin = app.get<ConfigService<Env, true>>(ConfigService).get('CORS_ORIGIN', { infer: true });

    admin = await signUp('admin');
    // Like the seed script: the first admin is set directly in the database
    adminId = (
      await prisma.user.update({
        where: { email: emailFor('admin') },
        data: { role: 'admin' },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: `e2e-${runId}-` } } });
    await app.close();
  });

  /** A client that keeps cookies between requests, like a browser. */
  const browser = () => request.agent(app.getHttpServer()).set('Origin', origin);

  async function signUp(name: string) {
    const agent = browser();
    await agent
      .post('/api/auth/sign-up/email')
      .send({ name: `User ${name}`, username: usernameFor(name), email: emailFor(name), password })
      .expect(200);
    return agent;
  }

  async function idOf(name: string) {
    return (await prisma.user.findUniqueOrThrow({ where: { email: emailFor(name) } })).id;
  }

  const logIn = (agent: request.Agent, name: string) =>
    agent.post('/api/auth/sign-in/email').send({ email: emailFor(name), password });

  describe('GET /api/admin/users', () => {
    it('lists users newest first, with paging and the total', async () => {
      await signUp('list1');
      await signUp('list2');
      const search = `${runId}_list`;

      const all = await admin.get('/api/admin/users').query({ search }).expect(200);
      const body = all.body as AdminUserList;
      expect(body).toMatchObject({ total: 2, page: 1, pageSize: 20 });
      expect(body.items.map((user) => user.email)).toEqual([emailFor('list2'), emailFor('list1')]);
      expect(body.items[0]).toEqual({
        id: expect.any(String) as string,
        name: 'User list2',
        username: usernameFor('list2'),
        email: emailFor('list2'),
        role: 'user',
        disabled: false,
        createdAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/) as string,
      });

      const page2 = await admin
        .get('/api/admin/users')
        .query({ search, page: 2, pageSize: 1 })
        .expect(200);
      expect(page2.body).toMatchObject({ total: 2, page: 2, pageSize: 1 });
      expect((page2.body as AdminUserList).items.map((user) => user.email)).toEqual([
        emailFor('list1'),
      ]);
    });

    it('searches username and email, in any case, with _ as a normal character', async () => {
      await signUp('Search_Me');
      await signUp('searchXme');
      const count = async (search: string) =>
        ((await admin.get('/api/admin/users').query({ search }).expect(200)).body as AdminUserList)
          .total;

      expect(await count(`${runId}_SEARCH_ME`.toUpperCase())).toBe(1);
      expect(await count(`e2e-${runId}-search_me@`)).toBe(1);
      // In SQL LIKE "_" means "any character": without escaping, this would also find "searchXme"
      expect(await count(`${runId}_search_me`)).toBe(1);
    });

    it('rejects invalid query parameters with one error per field', async () => {
      const response = await admin
        .get('/api/admin/users')
        .query({ page: 0, search: 'a'.repeat(31) })
        .expect(400);

      expect(response.body).toEqual({
        code: 'VALIDATION_FAILED',
        message: 'Please check the highlighted fields.',
        fieldErrors: [
          { field: 'page', message: 'This value is not valid.' },
          { field: 'search', message: 'Use at most 30 characters.' },
        ],
      });
    });

    it('is only for admins', async () => {
      await browser().get('/api/admin/users').expect(401);
      const user = await signUp('notadmin');
      await user.get('/api/admin/users').expect(403);
    });
  });

  describe('PATCH /api/admin/users/:id', () => {
    it('changes the role, and only the fields that are allowed', async () => {
      await signUp('role');
      const id = await idOf('role');

      const response = await admin
        .patch(`/api/admin/users/${id}`)
        .send({ role: 'admin', email: 'hacked@example.com' })
        .expect(200);

      expect(response.body).toMatchObject({ id, role: 'admin', email: emailFor('role') });
      expect(await prisma.user.findUniqueOrThrow({ where: { id } })).toMatchObject({
        role: 'admin',
        email: emailFor('role'),
      });
    });

    it('disables a user: logged out at once, can not log in, until enabled again', async () => {
      const user = await signUp('disable');
      const id = await idOf('disable');

      const disabled = await admin
        .patch(`/api/admin/users/${id}`)
        .send({ disabled: true })
        .expect(200);
      expect((disabled.body as AdminUser).disabled).toBe(true);

      // The open session is gone
      expect((await user.get('/api/auth/get-session').expect(200)).body).toBeNull();
      expect(await prisma.session.count({ where: { userId: id } })).toBe(0);

      // And a new login is blocked
      const login = await logIn(user, 'disable').expect(403);
      expect(login.body).toEqual({
        code: 'BANNED_USER',
        message: 'Your account has been disabled. Please contact support.',
      });

      await admin.patch(`/api/admin/users/${id}`).send({ disabled: false }).expect(200);
      await logIn(user, 'disable').expect(200);
    });

    it("doesn't let an admin change their own role or disable themselves", async () => {
      const ownRole = await admin
        .patch(`/api/admin/users/${adminId}`)
        .send({ role: 'user' })
        .expect(400);
      expect(ownRole.body).toEqual({
        code: 'CANNOT_CHANGE_OWN_ROLE',
        message: "You can't change your own role.",
      });

      const disableSelf = await admin
        .patch(`/api/admin/users/${adminId}`)
        .send({ disabled: true })
        .expect(400);
      expect(disableSelf.body).toMatchObject({ code: 'CANNOT_DISABLE_SELF' });

      // Nothing was saved, and the admin is still logged in
      expect(await prisma.user.findUniqueOrThrow({ where: { id: adminId } })).toMatchObject({
        role: 'admin',
        banned: false,
      });
      await admin.get('/api/admin/users').expect(200);
    });

    it('returns 404 for an unknown user and 400 for an unknown role', async () => {
      const unknown = await admin
        .patch('/api/admin/users/does-not-exist')
        .send({ disabled: true })
        .expect(404);
      expect(unknown.body).toMatchObject({ code: 'USER_NOT_FOUND' });

      await admin.patch(`/api/admin/users/${adminId}`).send({ role: 'superadmin' }).expect(400);
    });
  });

  it("closes Better Auth's own admin endpoints", async () => {
    await admin.get('/api/auth/admin/list-users').expect(404);
    await admin.post('/api/auth/admin/ban-user').send({ userId: adminId }).expect(404);
  });
});
