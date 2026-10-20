import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module.js';
import { DEFAULT_JOB_OPTIONS, NOTIFY_QUEUE } from '../queues/queues.js';
import { NotifyProcessor } from './notify.processor.js';
import { NotifyService } from './notify.service.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: NOTIFY_QUEUE,
      // 3 attempts, waiting 30s, then 60s: e.g. Resend is briefly down or rate-limited
      defaultJobOptions: {
        ...DEFAULT_JOB_OPTIONS,
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
      },
    }),
    // Sends through ChannelsService
    ChannelsModule,
  ],
  providers: [NotifyService, NotifyProcessor],
  // The match worker queues the new notifications
  exports: [NotifyService],
})
export class NotificationsModule {}
