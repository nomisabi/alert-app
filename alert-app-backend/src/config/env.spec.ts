import { validateEnv } from './env.js';

// The variables every start needs (example values)
const required = {
  CORS_ORIGIN: 'http://localhost:5174',
  DATABASE_URL: 'postgresql://user:password@localhost:5433/alert_app',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3000',
};

describe('validateEnv: SLACK_ENABLED', () => {
  it('is on when not set (users connect Slack themselves, there is no key)', () => {
    expect(validateEnv(required).SLACK_ENABLED).toBe(true);
  });

  it('reads "true" and "false" from .env (text) as booleans', () => {
    expect(validateEnv({ ...required, SLACK_ENABLED: 'false' }).SLACK_ENABLED).toBe(false);
    expect(validateEnv({ ...required, SLACK_ENABLED: 'true' }).SLACK_ENABLED).toBe(true);
  });

  it('refuses to start with a value that is neither', () => {
    expect(() => validateEnv({ ...required, SLACK_ENABLED: 'maybe' })).toThrow(/SLACK_ENABLED/);
  });
});
