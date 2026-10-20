import {
  ALERT_RULES_PER_USER_MAX,
  appCategorySchema,
  type AlertRule,
  type AlertRuleList,
  type AppCategory,
  type CreateAlertRuleRequest,
  type UpdateAlertRuleRequest,
} from '@alert-app/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ChannelsService } from '../channels/channels.service.js';
import { ApiException } from '../errors/api.exception.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Every query loads the rule's channel ids, in the order of the channel list (oldest first). */
const withChannels = {
  channels: { select: { channelId: true }, orderBy: { channel: { createdAt: 'asc' } } },
} satisfies Prisma.AlertRuleInclude;
type AlertRuleRow = Prisma.AlertRuleGetPayload<{ include: typeof withChannels }>;

/**
 * A user's own alert rules. Every query filters by `userId`, so nobody can see or change
 * someone else's rule. Their rules simply look like "not found" (404, not 403: a 403 would
 * tell the caller that the rule exists).
 */
@Injectable()
export class AlertRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly channels: ChannelsService,
  ) {}

  /** All rules of the user, newest first. At most 20, so no pagination. */
  async list(userId: string): Promise<AlertRuleList> {
    const rows = await this.prisma.alertRule.findMany({
      where: { userId },
      include: withChannels,
      // `id` as a tie-breaker for rules created in the same millisecond (uuid v7 sorts by time)
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return { items: rows.map(toAlertRule) };
  }

  async get(userId: string, ruleId: string): Promise<AlertRule> {
    return toAlertRule(await this.findOwn(this.prisma, userId, ruleId));
  }

  async create(userId: string, request: CreateAlertRuleRequest): Promise<AlertRule> {
    // Count and create in one transaction, so the limit check and the insert belong together.
    // (Two requests at exactly the same moment could still both pass; for a limit of 20 that's fine.)
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.alertRule.count({ where: { userId } });
      if (count >= ALERT_RULES_PER_USER_MAX) {
        throw new ApiException(HttpStatus.BAD_REQUEST, 'ALERT_RULE_LIMIT_REACHED');
      }
      await this.channels.assertOwnChannels(tx, userId, request.channelIds);

      const row = await tx.alertRule.create({
        data: {
          userId,
          name: request.name,
          enabled: request.enabled,
          ...matchFields(request),
          // One row in the join table per channel
          channels: { create: request.channelIds.map((channelId) => ({ channelId })) },
        },
        include: withChannels,
      });
      return toAlertRule(row);
    });
  }

  /**
   * Only the fields in `changes` are touched. Sending `type` replaces keywords/category,
   * sending `channelIds` replaces the whole channel list.
   */
  async update(
    userId: string,
    ruleId: string,
    changes: UpdateAlertRuleRequest,
  ): Promise<AlertRule> {
    return this.prisma.$transaction(async (tx) => {
      await this.findOwn(tx, userId, ruleId);
      if (changes.channelIds) await this.channels.assertOwnChannels(tx, userId, changes.channelIds);

      const match = matchChange(changes);
      const row = await tx.alertRule.update({
        where: { id: ruleId },
        // `undefined` = Prisma leaves the column (or the channel list) unchanged
        data: {
          name: changes.name,
          enabled: changes.enabled,
          ...(match && matchFields(match)),
          channels: changes.channelIds && {
            // Replace the list: remove the old links, add the new ones
            deleteMany: {},
            create: changes.channelIds.map((channelId) => ({ channelId })),
          },
        },
        include: withChannels,
      });
      return toAlertRule(row);
    });
  }

  async delete(userId: string, ruleId: string): Promise<void> {
    // One query: deletes the rule only if it belongs to the user
    const { count } = await this.prisma.alertRule.deleteMany({ where: { id: ruleId, userId } });
    if (count === 0) throw new ApiException(HttpStatus.NOT_FOUND, 'ALERT_RULE_NOT_FOUND');
  }

  /** The user's rule, or 404. Works with the normal client and inside a transaction. */
  private async findOwn(db: Prisma.TransactionClient, userId: string, ruleId: string) {
    // findFirst, not findUnique: the filter has the owner as well as the id
    const row = await db.alertRule.findFirst({
      where: { id: ruleId, userId },
      include: withChannels,
    });
    if (!row) throw new ApiException(HttpStatus.NOT_FOUND, 'ALERT_RULE_NOT_FOUND');
    return row;
  }
}

/** How a rule matches: its type with that type's field. */
type MatchInput =
  { type: 'keywords'; keywords: string[] } | { type: 'category'; category: AppCategory };

/** The type and its field, if the update changes how the rule matches. */
function matchChange(changes: UpdateAlertRuleRequest): MatchInput | undefined {
  // The schema guarantees that `type` comes with its field
  if (changes.type === 'keywords' && changes.keywords) {
    return { type: 'keywords', keywords: changes.keywords };
  }
  if (changes.type === 'category' && changes.category) {
    return { type: 'category', category: changes.category };
  }
  return undefined;
}

/** The columns that say how the rule matches. Only the field of the type is filled, the other is cleared. */
function matchFields(input: MatchInput) {
  return input.type === 'keywords'
    ? { type: input.type, keywords: input.keywords, category: null }
    : { type: input.type, keywords: [], category: input.category };
}

/** Database row → API shape. */
function toAlertRule(row: AlertRuleRow): AlertRule {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    keywords: row.keywords,
    // The column is plain text. A category removed from our list later shows up as "other".
    category:
      row.category === null ? null : (appCategorySchema.safeParse(row.category).data ?? 'other'),
    enabled: row.enabled,
    channelIds: row.channels.map((link) => link.channelId),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
