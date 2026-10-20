import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { NOTIFY_QUEUE } from '../queues/queues.js';
import { NotifyService, type NotifyJobData } from './notify.service.js';

/**
 * The worker of the notify queue: one job per notification.
 * limiter: at most 2 jobs per second, because Resend accepts at most 2 requests per second.
 */
@Processor(NOTIFY_QUEUE, { limiter: { max: 2, duration: 1000 } })
export class NotifyProcessor extends WorkerHost {
  constructor(private readonly notifyService: NotifyService) {
    super();
  }

  async process(job: Job<NotifyJobData>): Promise<void> {
    // attemptsMade = tries before this one
    await this.notifyService.send(
      job.data.notificationId,
      job.attemptsMade + 1,
      job.opts.attempts ?? 1,
    );
  }
}
