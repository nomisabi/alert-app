import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { MatchingModule } from '../matching/matching.module.js';
import { DEFAULT_JOB_OPTIONS, INGEST_QUEUE } from '../queues/queues.js';
import { IngestProcessor } from './ingest.processor.js';
import { IngestService } from './ingest.service.js';
import { NEWS_SOURCES, type NewsSourceAdapter } from './news-source-adapter.js';
import { NewsSourcesController } from './news-sources.controller.js';
import { NewsSourcesService } from './news-sources.service.js';
import { NewsDataAdapter } from './newsdata/newsdata.adapter.js';

@Module({
  imports: [
    // A failed fetch isn't retried (each try costs 10 requests): the next scheduled one runs anyway
    BullModule.registerQueue({
      name: INGEST_QUEUE,
      defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, attempts: 1 },
    }),
    // New articles are handed to the match queue
    MatchingModule,
  ],
  controllers: [NewsSourcesController],
  providers: [
    NewsSourcesService,
    IngestService,
    IngestProcessor,
    {
      // The sources that have an API key. Adding a source: one more line here.
      provide: NEWS_SOURCES,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): NewsSourceAdapter[] => {
        const newsDataKey = config.get('NEWSDATA_API_KEY', { infer: true });
        return newsDataKey ? [new NewsDataAdapter(newsDataKey)] : [];
      },
    },
  ],
})
export class NewsSourcesModule {}
