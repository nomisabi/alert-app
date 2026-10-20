import { z } from 'zod';
import { CHANNEL_TYPES, CHANNELS_PER_RULE_MAX } from '../constants/channels.js';

export const channelTypeSchema = z.enum(CHANNEL_TYPES);
export type ChannelType = z.infer<typeof channelTypeSchema>;

/** One channel in GET /api/channels: where a user's alerts are sent. */
export const channelSchema = z.object({
  id: z.string(),
  type: channelTypeSchema,
  /**
   * What the page shows, filled by the backend for every type: the email address for email,
   * e.g. "#alerts" for Slack later. The frontend doesn't need to know how a type stores its settings.
   */
  destination: z.string(),
});
export type Channel = z.infer<typeof channelSchema>;

/** Response of GET /api/channels. Oldest first, so the email channel comes first. */
export const channelListSchema = z.object({
  items: z.array(channelSchema),
});
export type ChannelList = z.infer<typeof channelListSchema>;

/**
 * The channels a rule sends to: 1–10 ids, no duplicates. Whether they are the user's own
 * channels is checked by the backend (400 INVALID_CHANNEL).
 * The errors belong to the `channelIds` field (one message under the "Send to" list).
 */
export const channelIdsSchema = z
  .array(z.string('channelIds.required'), 'channelIds.required')
  .superRefine((channelIds, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });

    if (channelIds.length === 0) return fail('channelIds.required');
    if (channelIds.length > CHANNELS_PER_RULE_MAX) return fail('channelIds.tooMany');
    if (new Set(channelIds).size !== channelIds.length) return fail('channelIds.duplicate');
  });
