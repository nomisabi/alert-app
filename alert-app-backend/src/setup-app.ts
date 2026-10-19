import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Env } from './config/env.js';
import { ApiExceptionFilter } from './errors/api-exception.filter.js';

/**
 * App-wide HTTP setup, shared by main.ts and the e2e tests
 * so tests run against the same configuration as the real server.
 */
export function setupApp(app: INestApplication) {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // All endpoints live under /api (e.g. /api/health)
  app.setGlobalPrefix('api');

  // Every error response has the same translated format: { code, message, fieldErrors? }
  app.useGlobalFilters(new ApiExceptionFilter());

  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }),
    credentials: true,
  });

  // Swagger UI at /api/docs, OpenAPI JSON at /api/docs-json (input for Orval)
  const openApiConfig = new DocumentBuilder()
    .setTitle('Alert App API')
    .setDescription('API for managing news alerts and notification channels')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, openApiConfig), {
    jsonDocumentUrl: 'api/docs-json',
  });

  // Lets Prisma disconnect cleanly when the process stops (Ctrl+C)
  app.enableShutdownHooks();
}
