import type { ConnectionOptions, DefaultJobOptions } from 'bullmq';

// Names of the BullMQ queues (one per step of the pipeline):
//   ingest: fetch the news and save the new articles
//   match:  find the rules the new articles match
//   notify: send the messages
export const INGEST_QUEUE = 'ingest';
export const MATCH_QUEUE = 'match';
export const NOTIFY_QUEUE = 'notify';

/** Every queue (the e2e tests remove them all after each test file). */
export const ALL_QUEUES = [INGEST_QUEUE, MATCH_QUEUE, NOTIFY_QUEUE];

/**
 * Job options for every queue. A queue with its own `defaultJobOptions` must spread these in:
 * @nestjs/bullmq replaces the shared ones instead of merging them.
 */
export const DEFAULT_JOB_OPTIONS: DefaultJobOptions = {
  // Keep the last 100 finished and failed jobs (for checking), not all of them forever
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 100 },
};

/** BullMQ's connection settings from a URL like redis://user:password@host:6379/2. */
export function redisConnection(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    // redis://host:6379/2 → database 2
    db: Number(url.pathname.slice(1) || 0),
  };
}
