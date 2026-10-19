import type { ApiError } from '@alert-app/shared';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import type { Env } from '../src/config/env.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { setupApp } from '../src/setup-app.js';

// End-to-end test of login: real app, real Better Auth, real database (npm run db:up first).
// Every run uses its own emails/usernames and deletes its users at the end.
describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let origin: string;

  const runId = Date.now().toString(36);
  const emailFor = (name: string) => `e2e-${runId}-${name}@example.com`;
  const usernameFor = (name: string) => `e2e_${runId}_${name}`;
  const password = 'secret123';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    // Better Auth only accepts POST requests from the frontend's origin
    origin = app.get<ConfigService<Env, true>>(ConfigService).get('CORS_ORIGIN', { infer: true });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: `e2e-${runId}-` } } });
    await app.close();
  });

  /** A client that keeps cookies between requests, like a browser. */
  const browser = () => request.agent(app.getHttpServer()).set('Origin', origin);

  async function signUp(name: string, agent = browser()) {
    await agent
      .post('/api/auth/sign-up/email')
      .send({
        name: `User ${name}`,
        username: usernameFor(name),
        email: emailFor(name),
        password,
      })
      .expect(200);
    return agent;
  }

  it('signs up as a normal user, even when the body asks for admin', async () => {
    const response = await browser()
      .post('/api/auth/sign-up/email')
      .send({
        name: 'New User',
        username: usernameFor('New'),
        email: emailFor('new').toUpperCase(),
        password,
        role: 'admin',
      })
      .expect(200);

    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('better-auth.session_token=')]),
    );
    expect(response.body).toMatchObject({
      user: {
        name: 'New User',
        email: emailFor('new'),
        username: usernameFor('new'),
        displayUsername: usernameFor('New'),
        role: 'user',
      },
    });
  });

  it('rejects invalid fields with one translated error per field', async () => {
    const response = await browser()
      .post('/api/auth/sign-up/email')
      .send({ name: '', username: 'abc', email: 'nope', password: 'password' })
      .expect(400);

    expect(response.body).toEqual({
      code: 'VALIDATION_FAILED',
      message: 'Please check the highlighted fields.',
      fieldErrors: [
        { field: 'name', message: 'Enter a display name.' },
        { field: 'username', message: 'Use at least 6 characters.' },
        { field: 'email', message: 'Enter a valid email address, e.g. name@example.com.' },
        { field: 'password', message: 'Add at least one number.' },
      ],
    } satisfies ApiError);
  });

  it('rejects a taken username (any case) and a taken email, on the right field', async () => {
    await signUp('taken');

    const takenUsername = await browser()
      .post('/api/auth/sign-up/email')
      .send({
        name: 'X',
        username: usernameFor('TAKEN'),
        email: emailFor('other'),
        password,
      });
    expect(takenUsername.body).toMatchObject({
      code: 'USERNAME_IS_ALREADY_TAKEN',
      fieldErrors: [{ field: 'username', message: 'This username is already taken.' }],
    });

    const takenEmail = await browser()
      .post('/api/auth/sign-up/email')
      .send({ name: 'X', username: usernameFor('other'), email: emailFor('taken'), password });
    expect(takenEmail.body).toMatchObject({
      code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
      fieldErrors: [{ field: 'email', message: 'An account with this email already exists.' }],
    });
  });

  it('tells whether a username is available', async () => {
    await signUp('avail');

    await browser()
      .post('/api/auth/is-username-available')
      .send({ username: usernameFor('AVAIL') })
      .expect(200, { available: false });
    await browser()
      .post('/api/auth/is-username-available')
      .send({ username: usernameFor('free') })
      .expect(200, { available: true });
  });

  it('logs in with the right password only', async () => {
    await signUp('login');

    const wrong = await browser()
      .post('/api/auth/sign-in/email')
      .send({ email: emailFor('login'), password: 'wrong-password1' })
      .expect(401);
    expect(wrong.body).toEqual({
      code: 'INVALID_EMAIL_OR_PASSWORD',
      message: 'Invalid email or password.',
    });

    const agent = browser();
    await agent
      .post('/api/auth/sign-in/email')
      .send({ email: emailFor('login'), password })
      .expect(200);
    const session = await agent.get('/api/auth/get-session').expect(200);
    expect(session.body).toMatchObject({ user: { email: emailFor('login') } });
  });

  it('logs out', async () => {
    const agent = await signUp('logout');

    await agent.post('/api/auth/sign-out').send({}).expect(200);
    const session = await agent.get('/api/auth/get-session').expect(200);
    expect(session.body).toBeNull();
  });

  it('protects the admin endpoint: 401 logged out, 403 for users, 200 for admins', async () => {
    await browser().get('/api/admin/ping').expect(401, {
      code: 'UNAUTHORIZED',
      message: 'Please log in to continue.',
    });

    const agent = await signUp('admin');
    await agent.get('/api/admin/ping').expect(403);

    // Like the seed script: the role is only set directly in the database
    await prisma.user.update({ where: { email: emailFor('admin') }, data: { role: 'admin' } });
    await agent.get('/api/admin/ping').expect(200, { ok: true });
  });

  it('has no "log in with username" endpoint', async () => {
    await browser()
      .post('/api/auth/sign-in/username')
      .send({ username: usernameFor('admin'), password })
      .expect(404);
  });

  it('rejects requests from other websites', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .set('Origin', 'https://evil.example')
      .send({ email: emailFor('login'), password })
      .expect(403);

    expect(response.body).toMatchObject({ code: 'INVALID_ORIGIN' });
  });
});
