// Seed script: fills the database with starting data. Run with: npm run db:seed
// Creates the first admin from ADMIN_* in .env. Running it again changes nothing.
import 'dotenv/config';
import {
  displayNameSchema,
  emailSchema,
  newPasswordSchema,
  usernameSchema,
} from '@alert-app/shared';
import { PrismaPg } from '@prisma/adapter-pg';
import { z } from 'zod';
import { createAuth } from '../src/auth/create-auth.js';
import { envSchema } from '../src/config/env.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

const seedEnvSchema = envSchema.extend({
  ADMIN_NAME: displayNameSchema,
  ADMIN_USERNAME: usernameSchema,
  ADMIN_EMAIL: emailSchema,
  ADMIN_PASSWORD: newPasswordSchema,
});

async function main() {
  const result = seedEnvSchema.safeParse(process.env);
  if (!result.success) {
    // The messages are i18n keys from the shared schemas, e.g. "password.needsNumber"
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  const env = result.data;

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });
  try {
    const existing = await prisma.user.findUnique({ where: { email: env.ADMIN_EMAIL } });

    if (existing) {
      console.log(`Admin ${env.ADMIN_EMAIL} already exists.`);
    } else {
      // Through Better Auth, so the password is hashed exactly like at a normal sign-up
      const auth = createAuth({
        prisma,
        secret: env.BETTER_AUTH_SECRET,
        baseURL: env.BETTER_AUTH_URL,
        trustedOrigins: [env.CORS_ORIGIN],
      });
      await auth.api.signUpEmail({
        body: {
          name: env.ADMIN_NAME,
          username: env.ADMIN_USERNAME,
          email: env.ADMIN_EMAIL,
          password: env.ADMIN_PASSWORD,
        },
      });
      console.log(`Created ${env.ADMIN_EMAIL}.`);
    }

    // The role can't be set through sign-up, so it's set directly in the database
    if (existing?.role !== 'admin') {
      await prisma.user.update({ where: { email: env.ADMIN_EMAIL }, data: { role: 'admin' } });
      console.log(`${env.ADMIN_EMAIL} is now an admin.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

await main();
