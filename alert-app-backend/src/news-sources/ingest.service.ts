import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NEWS_SOURCES, type NewsSourceAdapter } from './news-source-adapter.js';

/** One fetch: every source's latest articles, saving only the ones we don't have yet. */
@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NEWS_SOURCES) private readonly sources: NewsSourceAdapter[],
  ) {}

  /**
   * @param batchId the id of this fetch (the ingest job's id), for the log
   * @returns the ids of the newly saved articles (step 4b matches them against the rules)
   */
  async ingest(batchId: string): Promise<string[]> {
    const newIds: string[] = [];

    for (const source of this.sources) {
      const articles = await source.fetchLatest();
      // skipDuplicates: articles whose URL (or source + externalId) is already saved are skipped
      // by the database itself, so two fetches at the same moment can't save one twice.
      // createManyAndReturn returns only the rows it really inserted.
      const saved = await this.prisma.article.createManyAndReturn({
        data: articles,
        skipDuplicates: true,
        select: { id: true },
      });
      newIds.push(...saved.map((article) => article.id));
      this.logger.log(
        `${source.sourceId} (batch ${batchId}): ${saved.length} new of ${articles.length} articles`,
      );
    }

    return newIds;
  }
}
