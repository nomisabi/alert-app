import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { DEFAULT_JOB_OPTIONS, redisConnection } from './queues.js';

/**
 * The Redis connection for every BullMQ queue and worker. A module that uses a queue registers it
 * with `BullModule.registerQueue({ name })`, and its worker is a class with `@Processor(name)`.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: redisConnection(config.get('REDIS_URL', { infer: true })),
        prefix: config.get('QUEUE_PREFIX', { infer: true }),
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      }),
    }),
  ],
})
export class QueuesModule {}
