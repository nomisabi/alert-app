import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/setup-app.js';

// End-to-end test: starts the real app against the real database.
// Requires Docker services to be running (npm run db:up).
describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health reports the database as up', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok', database: 'up' });
  });

  it('GET /api/docs-json serves the OpenAPI spec', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    const spec = response.body as OpenAPIObject;

    expect(spec.paths).toHaveProperty('/api/health');
  });
});
