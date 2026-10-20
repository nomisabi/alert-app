import { z } from 'zod';

// Every environment variable the backend needs. The app refuses to start
// if one is missing or invalid, so misconfiguration fails fast.
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.url(),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  // Email (milestone 4). Without a key, emails are only written to the log (LogEmailProvider).
  // An empty value in .env counts as "not set".
  RESEND_API_KEY: z
    .string()
    .trim()
    .optional()
    .transform((key) => key || undefined),
  // Without a verified domain, Resend's test sender only delivers to the Resend account's own email
  EMAIL_FROM: z.string().min(1).default('Alert App <onboarding@resend.dev>'),
  // Slack (milestone 7): users paste their own webhook URLs, so there is no key. "false" = Slack
  // messages are only written to the log (LogSlackWebhookClient), e.g. in the e2e tests.
  SLACK_ENABLED: z.stringbool().default(true),
  // Background jobs (milestone 5): Redis from docker-compose.yml holds the BullMQ queues
  REDIS_URL: z.url().default('redis://localhost:6379'),
  // Start of every queue's Redis keys. The e2e tests use their own, so they never touch the
  // queues of the running backend (see test/setup-e2e.ts).
  QUEUE_PREFIX: z.string().min(1).default('alert-app'),
  // NewsData.io (https://newsdata.io). Without a key, no news is fetched (only a warning).
  NEWSDATA_API_KEY: z
    .string()
    .trim()
    .optional()
    .transform((key) => key || undefined),
  // How often news is fetched. Each fetch costs 10 of the ~200 free requests a day:
  // every 120 minutes = 120 a day.
  NEWS_POLL_INTERVAL_MINUTES: z.coerce.number().int().min(15).default(120),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }

  return result.data;
}
