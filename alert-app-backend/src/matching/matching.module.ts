import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { DEFAULT_JOB_OPTIONS, MATCH_QUEUE } from '../queues/queues.js';
import { MatchProcessor } from './match.processor.js';
import { MatchService } from './match.service.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: MATCH_QUEUE,
      // 3 attempts, waiting 5s, then 10s (matching uses only our database, so a retry is free)
      defaultJobOptions: {
        ...DEFAULT_JOB_OPTIONS,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
      },
    }),
    // New notifications are handed to the notify queue
    NotificationsModule,
  ],
  providers: [MatchService, MatchProcessor],
  // The ingest worker queues the matching of new articles
  exports: [MatchService],
})
export class MatchingModule {}
