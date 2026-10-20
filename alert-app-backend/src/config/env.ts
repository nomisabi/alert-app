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
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }

  return result.data;
}
