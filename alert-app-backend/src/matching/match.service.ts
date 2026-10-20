import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import { MATCH_QUEUE } from '../queues/queues.js';
import { ruleMatcher } from './rule-matcher.js';

/** The data of one match job: the new articles of one fetch. */
export interface MatchJobData {
  batchId: string;
  articleIds: string[];
}

const MATCH_JOB_NAME = 'match';

/** Turns the new articles of a fetch into pending notifications (one per rule and channel). */
@Injectable()
export class MatchService {
  private readonly logger = new Logger(MatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(MATCH_QUEUE) private readonly matchQueue: Queue<MatchJobData>,
  ) {}

  /** Queues the matching of a fetch's new articles (called by the ingest worker). */
  async enqueue(batchId: string, articleIds: string[]): Promise<void> {
    await this.matchQueue.add(MATCH_JOB_NAME, { batchId, articleIds });
  }

  /**
   * Matches the articles against every enabled rule of users who aren't disabled, and saves one
   * pending notification per matching rule and channel, with all the rule's matched articles.
   * Safe to run twice for the same batch (a retry): existing notifications are left as they are.
   * @returns the ids of the batch's notifications
   */
  async match({ batchId, articleIds }: MatchJobData): Promise<string[]> {
    const [articles, rules] = await Promise.all([
      this.prisma.article.findMany({
        where: { id: { in: articleIds } },
        select: { id: true, title: true, description: true, categories: true, createdAt: true },
      }),
      this.prisma.alertRule.findMany({
        where: { enabled: true, user: { banned: false } },
        select: {
          id: true,
          type: true,
          keywords: true,
          category: true,
          createdAt: true,
          channels: { select: { channelId: true } },
        },
      }),
    ]);

    // One entry per rule with at least one matching article
    const matches = rules.flatMap((rule) => {
      const matcher = ruleMatcher(rule);
      const matchedIds = articles.filter(matcher).map((article) => article.id);
      return matchedIds.length > 0 ? [{ rule, articleIds: matchedIds }] : [];
    });

    // One transaction: either all of the batch's notifications are saved, or none
    const notificationIds = await this.prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (const { rule, articleIds: matchedIds } of matches) {
        for (const { channelId } of rule.channels) {
          // upsert with an empty update: created the first time, left unchanged on a retry
          // (unique batch + rule + channel)
          const notification = await tx.notification.upsert({
            where: {
              batchId_alertRuleId_channelId: { batchId, alertRuleId: rule.id, channelId },
            },
            create: {
              batchId,
              alertRuleId: rule.id,
              channelId,
              articles: { create: matchedIds.map((articleId) => ({ articleId })) },
            },
            update: {},
            select: { id: true },
          });
          ids.push(notification.id);
        }
      }
      return ids;
    });

    this.logger.log(
      `Batch ${batchId}: ${articles.length} articles, ${rules.length} rules → ` +
        `${matches.length} matching rules, ${notificationIds.length} notifications`,
    );
    return notificationIds;
  }
}
