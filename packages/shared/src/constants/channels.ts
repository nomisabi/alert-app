/** Where alerts can be sent. Every user has one email channel and can connect one Slack channel. */
export const CHANNEL_TYPES = ['email', 'slack'] as const;

/** One test message per channel in this many seconds (the email quota is shared by all users). */
export const CHANNEL_TEST_COOLDOWN_SECONDS = 60;

/** Channels one rule can send to. Only a limit for the request size: users have few channels. */
export const CHANNELS_PER_RULE_MAX = 10;

/** The name the user gives their Slack channel, e.g. "#news in Acme". */
export const CHANNEL_NAME_MAX_LENGTH = 50;

/**
 * Only Slack's own webhook address: our server must never post to any URL a user types in
 * (SSRF). The three parts are Slack's workspace, webhook and secret ids.
 */
export const SLACK_WEBHOOK_URL_PATTERN =
  /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+$/;
