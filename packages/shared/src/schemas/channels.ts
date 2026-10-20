import { z } from 'zod';
import {
  CHANNEL_NAME_MAX_LENGTH,
  CHANNEL_TYPES,
  CHANNELS_PER_RULE_MAX,
  SLACK_WEBHOOK_URL_PATTERN,
} from '../constants/channels.js';

export const channelTypeSchema = z.enum(CHANNEL_TYPES);
export type ChannelType = z.infer<typeof channelTypeSchema>;

/** One channel in GET /api/channels: where a user's alerts are sent. */
export const channelSchema = z.object({
  id: z.string(),
  type: channelTypeSchema,
  /**
   * What the page shows, filled by the backend for every type: the email address for email, the
   * name the user gave it for Slack (never the webhook URL, it's a secret). The frontend doesn't
   * need to know how a type stores its settings.
   */
  destination: z.string(),
});
export type Channel = z.infer<typeof channelSchema>;

/** Response of GET /api/channels. Oldest first, so the email channel comes first. */
export const channelListSchema = z.object({
  items: z.array(channelSchema),
});
export type ChannelList = z.infer<typeof channelListSchema>;

export const channelNameSchema = z
  .string('channelName.required')
  .trim()
  .min(1, 'channelName.required')
  .max(CHANNEL_NAME_MAX_LENGTH, 'channelName.tooLong');

export const slackWebhookUrlSchema = z
  .string('slackWebhookUrl.required')
  .trim()
  .min(1, { message: 'slackWebhookUrl.required', abort: true }) // empty: only "required"
  .regex(SLACK_WEBHOOK_URL_PATTERN, 'slackWebhookUrl.invalid');

/** What a Slack channel stores in `config`. Also checked by SlackChannel.validateConfig(). */
export const slackChannelConfigSchema = z.object({
  name: channelNameSchema,
  webhookUrl: slackWebhookUrlSchema,
});
export type SlackChannelConfig = z.infer<typeof slackChannelConfigSchema>;

/**
 * Body of POST /api/channels, also used by the "Connect Slack" form (which sets `type` itself).
 * Split by `type`, so a later type adds its own fields here. Email can't be created: every user
 * has exactly one, made at sign-up.
 */
export const createChannelRequestSchema = z.discriminatedUnion(
  'type',
  [slackChannelConfigSchema.extend({ type: z.literal('slack') })],
  'invalid',
);
export type CreateChannelRequest = z.infer<typeof createChannelRequestSchema>;

/**
 * Body of PATCH /api/channels/:id: only the sent fields change. Only Slack channels can be
 * edited (the email channel is the account email). A new `webhookUrl` is checked with a test
 * message before it's saved.
 */
export const updateChannelRequestSchema = z.object({
  name: channelNameSchema.optional(),
  webhookUrl: slackWebhookUrlSchema.optional(),
});
export type UpdateChannelRequest = z.infer<typeof updateChannelRequestSchema>;

/**
 * The "Edit Slack" form. The API never returns the webhook URL (it's a secret), so the field
 * starts empty: empty keeps the current URL, anything else must be a Slack webhook URL.
 */
export const editSlackChannelFormSchema = z.object({
  name: channelNameSchema,
  webhookUrl: z
    .string('slackWebhookUrl.invalid')
    .trim()
    .refine((url) => url === '' || SLACK_WEBHOOK_URL_PATTERN.test(url), 'slackWebhookUrl.invalid'),
});
export type EditSlackChannelFormValues = z.infer<typeof editSlackChannelFormSchema>;

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
