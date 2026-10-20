import {
  CHANNEL_TEST_COOLDOWN_SECONDS,
  type Channel,
  type ChannelList,
  type ChannelType,
} from '@alert-app/shared';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { differenceInMilliseconds, subSeconds } from 'date-fns';
import { ApiException } from '../errors/api.exception.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { Language } from '../i18n/i18n.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  NOTIFICATION_CHANNELS,
  type ChannelMessage,
  type ChannelTarget,
  type NotificationChannel,
} from './notification-channel.js';

/** A channel row with the owner fields that sending needs. */
const withUser = { user: { select: { email: true, name: true } } } satisfies Prisma.ChannelInclude;
type ChannelRow = Prisma.ChannelGetPayload<{ include: typeof withUser }>;

/**
 * A user's own channels. Like alert rules, every query filters by `userId`: another user's
 * channel looks "not found".
 */
@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);
  private readonly channels: Map<ChannelType, NotificationChannel>;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_CHANNELS) channels: NotificationChannel[],
  ) {
    this.channels = new Map(channels.map((channel) => [channel.type, channel]));
  }

  /** All channels of the user, oldest first (so the email channel comes first). */
  async list(userId: string): Promise<ChannelList> {
    const rows = await this.prisma.channel.findMany({
      where: { userId },
      include: withUser,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return { items: rows.map((row) => this.toChannel(row)) };
  }

  /**
   * Sends a test message, at most one per channel per minute.
   *
   * The time is saved *before* sending, in one "update if the last test is old enough" query.
   * The database runs that query as one step (atomic), so two clicks at the same moment can't
   * both pass the check. A failed send also counts, so a broken setup can't use up the quota.
   */
  async sendTest(userId: string, channelId: string, language: Language): Promise<void> {
    const now = new Date();
    const { count } = await this.prisma.channel.updateMany({
      where: {
        id: channelId,
        userId,
        OR: [
          { lastTestSentAt: null },
          { lastTestSentAt: { lte: subSeconds(now, CHANNEL_TEST_COOLDOWN_SECONDS) } },
        ],
      },
      data: { lastTestSentAt: now },
    });
    if (count === 0) await this.throwNotFoundOrTooSoon(userId, channelId, now);

    const row = await this.prisma.channel.findFirstOrThrow({
      where: { id: channelId, userId },
      include: withUser,
    });
    try {
      await this.channelOf(row.type).send(toTarget(row), { kind: 'test' }, language);
    } catch (error) {
      // The details (e.g. Resend's error) only go to the log, the user gets a general text
      this.logger.error(`Test message for channel ${channelId} failed`, error);
      throw new ApiException(HttpStatus.BAD_GATEWAY, 'CHANNEL_TEST_FAILED');
    }
  }

  /**
   * Sends a message through a channel (any user's: for the background jobs, not for requests).
   * Throws when the channel doesn't exist or sending fails.
   */
  async send(channelId: string, message: ChannelMessage, language: Language): Promise<void> {
    const row = await this.prisma.channel.findUniqueOrThrow({
      where: { id: channelId },
      include: withUser,
    });
    await this.channelOf(row.type).send(toTarget(row), message, language);
  }

  /**
   * Throws 400 INVALID_CHANNEL (on the `channelIds` field) unless every id is one of the user's
   * channels. Unknown ids, other users' channels and malformed ids all look the same.
   * Works with the normal client and inside a transaction.
   */
  async assertOwnChannels(
    db: Prisma.TransactionClient,
    userId: string,
    channelIds: string[],
  ): Promise<void> {
    const count = await db.channel.count({ where: { id: { in: channelIds }, userId } });
    if (count !== channelIds.length) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_CHANNEL', [
        { field: 'channelIds', key: 'errors:INVALID_CHANNEL' },
      ]);
    }
  }

  /** The channel doesn't exist for this user (404), or its last test is too recent (429). */
  private async throwNotFoundOrTooSoon(
    userId: string,
    channelId: string,
    now: Date,
  ): Promise<never> {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, userId },
      select: { lastTestSentAt: true },
    });
    if (!channel?.lastTestSentAt) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'CHANNEL_NOT_FOUND');
    }

    const waitedMs = differenceInMilliseconds(now, channel.lastTestSentAt);
    const seconds = Math.max(1, Math.ceil(CHANNEL_TEST_COOLDOWN_SECONDS - waitedMs / 1000));
    throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, 'CHANNEL_TEST_TOO_SOON', [], {
      values: { seconds },
      // The standard way to tell a client when to try again
      headers: { 'Retry-After': String(seconds) },
    });
  }

  private channelOf(type: ChannelType): NotificationChannel {
    const channel = this.channels.get(type);
    if (!channel) throw new Error(`No NotificationChannel registered for type "${type}"`);
    return channel;
  }

  /** Database row → API shape. */
  private toChannel(row: ChannelRow): Channel {
    return {
      id: row.id,
      type: row.type,
      destination: this.channelOf(row.type).destination(toTarget(row)),
    };
  }
}

function toTarget(row: ChannelRow): ChannelTarget {
  return { config: row.config, user: row.user };
}
