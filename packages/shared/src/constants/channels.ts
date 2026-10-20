/** Where alerts can be sent. Slack is added in milestone 7. */
export const CHANNEL_TYPES = ['email'] as const;

/** One test message per channel in this many seconds (the email quota is shared by all users). */
export const CHANNEL_TEST_COOLDOWN_SECONDS = 60;

/** Channels one rule can send to. Only a limit for the request size: users have few channels. */
export const CHANNELS_PER_RULE_MAX = 10;
