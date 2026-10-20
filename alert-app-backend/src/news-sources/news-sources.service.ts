import type { FetchNewsResponse } from '@alert-app/shared';
import { InjectQueue } from '@nestjs/bullmq';
import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import type { Env } from '../config/env.js';
import { ApiException } from '../errors/api.exception.js';
import { INGEST_QUEUE } from '../queues/queues.js';
import { NEWS_SOURCES, type NewsSourceAdapter } from './news-source-adapter.js';

/** The id of the repeating fetch in Redis. Kept across restarts. */
export const FETCH_NEWS_SCHEDULER_ID = 'fetch-news';
const INGEST_JOB_NAME = 'ingest';

/** Starts fetches: on a schedule, and when an admin asks ("fetch now"). */
@Injectable()
export class NewsSourcesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NewsSourcesService.name);

  constructor(
    @InjectQueue(INGEST_QUEUE) private readonly ingestQueue: Queue,
    @Inject(NEWS_SOURCES) private readonly sources: NewsSourceAdapter[],
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Creates (or updates) the repeating fetch when the app starts. The schedule lives in Redis:
   * a restart with the same interval keeps the next run time, so restarting (e.g. watch mode)
   * doesn't fetch again. Only the first start, or a new interval, fetches right away.
   */
  async onApplicationBootstrap() {
    if (this.sources.length === 0) {
      this.logger.warn('NEWSDATA_API_KEY is not set: no news is fetched.');
      await this.ingestQueue.removeJobScheduler(FETCH_NEWS_SCHEDULER_ID);
      return;
    }

    const minutes = this.config.get('NEWS_POLL_INTERVAL_MINUTES', { infer: true });
    await this.ingestQueue.upsertJobScheduler(
      FETCH_NEWS_SCHEDULER_ID,
      { every: minutes * 60_000 },
      { name: INGEST_JOB_NAME },
    );
    this.logger.log(`News is fetched every ${minutes} minutes.`);
  }

  /**
   * Queues a fetch right away. While one is still waiting or running, no second one is queued
   * (each fetch costs 10 of the ~200 free NewsData.io requests a day): its id is returned instead.
   */
  async fetchNow(): Promise<FetchNewsResponse> {
    if (this.sources.length === 0) {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'NEWS_SOURCE_NOT_CONFIGURED');
    }

    // Not "delayed": that's the next scheduled fetch, hours away
    const [queued] = await this.ingestQueue.getJobs(['active', 'waiting'], 0, 0);
    if (queued?.id) return { batchId: queued.id };

    // Our own unique id: BullMQ's default ids (1, 2, 3, ...) start again after Redis is emptied,
    // and a reused batchId would block that batch's notifications (unique per batch, rule, channel)
    const job = await this.ingestQueue.add(INGEST_JOB_NAME, {}, { jobId: randomUUID() });
    return { batchId: job.id! };
  }
}
