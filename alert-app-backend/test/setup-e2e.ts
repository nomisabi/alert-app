import { Queue } from 'bullmq';
import { ALL_QUEUES, redisConnection } from '../src/queues/queues.js';

// Runs before each e2e test file (setupFiles in vitest.config.e2e.ts). Values set here win over .env.

// Never fetch real news: .env holds a real NewsData.io key, and every fetch costs 10 of the
// ~200 free requests a day. Tests that need a source replace NEWS_SOURCES with a fake.
process.env.NEWSDATA_API_KEY = '';

// Never send real email: .env may hold a real Resend key, and the test articles are matched
// against every rule in the database, also the developer's own. Emails only go to the log
// (LogEmailProvider). Tests that check emails replace EmailProvider with a fake.
process.env.RESEND_API_KEY = '';

// Own queues per test file: the tests never take jobs of the running backend (or of another
// test file running in parallel), and the backend never takes theirs.
const prefix = `e2e-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
process.env.QUEUE_PREFIX = prefix;

// After the test file: remove its queues (all their keys) from Redis
afterAll(async () => {
  const connection = redisConnection(process.env.REDIS_URL ?? 'redis://localhost:6379');
  for (const name of ALL_QUEUES) {
    const queue = new Queue(name, { connection, prefix });
    await queue.obliterate({ force: true });
    await queue.close();
  }
});
