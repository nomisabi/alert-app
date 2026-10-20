import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { NotifyService } from '../notifications/notify.service.js';
import { MATCH_QUEUE } from '../queues/queues.js';
import { MatchService, type MatchJobData } from './match.service.js';

/**
 * The worker of the match queue: one job per fetch that saved new articles.
 * A failed job (e.g. the database was briefly unavailable) is retried (see MatchingModule).
 */
@Processor(MATCH_QUEUE)
export class MatchProcessor extends WorkerHost {
  constructor(
    private readonly matchService: MatchService,
    private readonly notifyService: NotifyService,
  ) {
    super();
  }

  async process(job: Job<MatchJobData>): Promise<{ notifications: number }> {
    const notificationIds = await this.matchService.match(job.data);
    // Next step: send them
    await this.notifyService.enqueue(notificationIds);
    return { notifications: notificationIds.length };
  }
}
