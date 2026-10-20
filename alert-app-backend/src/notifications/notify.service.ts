import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, UnrecoverableError } from 'bullmq';
import { ChannelsService } from '../channels/channels.service.js';
import type { Env } from '../config/env.js';
import { PermanentSendError } from '../errors/permanent-send-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NOTIFY_QUEUE } from '../queues/queues.js';

/** The data of one notify job: one notification (one message to one channel). */
export interface NotifyJobData {
  notificationId: string;
}

const NOTIFY_JOB_NAME = 'notify';

/** Sends pending notifications and records the result (status, attempts, error). */
@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly channels: ChannelsService,
    private readonly config: ConfigService<Env, true>,
    @InjectQueue(NOTIFY_QUEUE) private readonly notifyQueue: Queue<NotifyJobData>,
  ) {}

  /** Queues the sending of notifications (called by the match worker). */
  async enqueue(notificationIds: string[]): Promise<void> {
    await this.notifyQueue.addBulk(
      notificationIds.map((notificationId) => ({
        name: NOTIFY_JOB_NAME,
        data: { notificationId },
        // The notification id as job id: queuing the same one twice (a retried match job) adds
        // no second job while the first is still in the queue
        opts: { jobId: notificationId },
      })),
    );
  }

  /**
   * Sends one notification. Saves the result before returning: `sent` (with `sentAt`), or the
   * error, `failed` after the last attempt (or at once for a PermanentSendError) and still
   * `pending` before it.
   * Throws when sending fails, so BullMQ tries again (see NotificationsModule), except for
   * permanent errors (UnrecoverableError: no more tries).
   * @param attempt this try's number (1, 2, 3)
   * @param maxAttempts how many tries there are in total
   */
  async send(notificationId: string, attempt: number, maxAttempts: number): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        alertRule: { select: { name: true } },
        articles: {
          select: {
            article: {
              select: {
                title: true,
                url: true,
                description: true,
                sourceName: true,
                publishedAt: true,
              },
            },
          },
          orderBy: { article: { publishedAt: 'desc' } },
        },
      },
    });
    // Deleted in the meantime (e.g. the rule was deleted), or already sent: nothing to do
    if (!notification || notification.status === 'sent') return;

    try {
      await this.channels.send(
        notification.channelId,
        {
          kind: 'alert',
          ruleName: notification.alertRule.name,
          articles: notification.articles.map(({ article }) => article),
          // CORS_ORIGIN is the frontend's address
          alertsUrl: `${this.config.get('CORS_ORIGIN', { infer: true })}/alerts`,
        },
        // Users have no language setting yet
        'en',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // e.g. an invalid address: another try would fail the same way
      const isPermanent = error instanceof PermanentSendError;
      const isLastAttempt = isPermanent || attempt >= maxAttempts;
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          attempts: { increment: 1 },
          error: message,
          status: isLastAttempt ? 'failed' : 'pending',
        },
      });
      this.logger.warn(
        `Notification ${notificationId}: ${failureText(attempt, maxAttempts, isPermanent)}: ${message}`,
      );
      // UnrecoverableError: BullMQ marks the job failed without the remaining attempts
      throw isPermanent ? new UnrecoverableError(message) : error;
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { attempts: { increment: 1 }, status: 'sent', sentAt: new Date(), error: null },
    });
  }
}

/**
 * What happens after a failed attempt, for the log. A permanent error is never retried, so it
 * doesn't show "1/3" (which would suggest more attempts are coming).
 */
export function failureText(attempt: number, maxAttempts: number, isPermanent: boolean): string {
  if (isPermanent) return `failed, not retried (permanent error)`;
  if (attempt >= maxAttempts) return `attempt ${attempt}/${maxAttempts} failed, giving up`;
  return `attempt ${attempt}/${maxAttempts} failed, will retry`;
}
