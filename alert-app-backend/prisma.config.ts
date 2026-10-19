// Prisma CLI configuration (migrations, generate, studio).
// Prisma 7 does not load .env automatically, so dotenv is imported here.
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // npm run db:seed (tsx runs TypeScript directly, without a build)
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
