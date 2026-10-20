import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { MatchService } from '../matching/match.service.js';
import { INGEST_QUEUE } from '../queues/queues.js';
import { IngestService } from './ingest.service.js';

/**
 * The worker of the ingest queue: BullMQ calls `process()` for each job, one at a time.
 * Jobs come from the schedule (every NEWS_POLL_INTERVAL_MINUTES) and from "fetch now".
 * A job that throws is marked failed (and logged by BullMQ); the next scheduled fetch tries again.
 */
@Processor(INGEST_QUEUE)
export class IngestProcessor extends WorkerHost {
  constructor(
    private readonly ingestService: IngestService,
    private readonly matchService: MatchService,
  ) {
    super();
  }

  async process(job: Job): Promise<{ newArticles: number }> {
    // The job id is the fetch's batchId (unique: a UUID, or "repeat:<scheduler>:<time>")
    const batchId = job.id!;
    const newIds = await this.ingestService.ingest(batchId);
    // Next step: find the rules the new articles match (nothing new → nothing to match)
    if (newIds.length > 0) await this.matchService.enqueue(batchId, newIds);
    // The return value is stored with the finished job (visible in Redis)
    return { newArticles: newIds.length };
  }
}
