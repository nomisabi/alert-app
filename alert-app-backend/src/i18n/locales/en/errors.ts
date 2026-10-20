import { ALERT_RULES_PER_USER_MAX } from '@alert-app/shared';

/**
 * Texts for API error codes (the `errors` i18n namespace). The key is the `code` in the error response.
 * Codes without a text here fall back to the text for their HTTP status (see i18n.ts).
 */
export const errorsEn = {
  // Generic, by HTTP status
  BAD_REQUEST: 'The request is not valid.',
  UNAUTHORIZED: 'Please log in to continue.',
  FORBIDDEN: "You don't have permission to do this.",
  NOT_FOUND: 'Not found.',
  UNPROCESSABLE_ENTITY: 'The request could not be processed.',
  TOO_MANY_REQUESTS: 'Too many attempts. Please wait a moment and try again.',
  INTERNAL_SERVER_ERROR: 'Something went wrong. Please try again later.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again later.',

  // Ours
  VALIDATION_FAILED: 'Please check the highlighted fields.',
  USER_NOT_FOUND: 'This user does not exist.',
  CANNOT_CHANGE_OWN_ROLE: "You can't change your own role.",
  CANNOT_DISABLE_SELF: "You can't disable your own account.",
  ALERT_RULE_NOT_FOUND: 'This alert does not exist.',
  ALERT_RULE_LIMIT_REACHED: `You can have at most ${ALERT_RULES_PER_USER_MAX} alerts. Delete one to add another.`,
  CHANNEL_NOT_FOUND: 'This channel does not exist.',
  // {{seconds}}: filled in by ChannelsService
  CHANNEL_TEST_TOO_SOON:
    'You can send one test message per minute. Please try again in {{seconds}} seconds.',
  CHANNEL_TEST_FAILED: "We couldn't send the test message. Please try again later.",
  // Also the field error under "Send to" (a channel that doesn't exist or isn't the user's)
  INVALID_CHANNEL: 'Choose one of your channels.',
  // PATCH on the email channel: it's the account email
  CHANNEL_NOT_EDITABLE: "This channel can't be edited.",
  SLACK_ALREADY_CONNECTED: "You've already connected Slack.",
  // Also the field error under "Webhook URL": Slack rejected the test message (4xx)
  SLACK_WEBHOOK_INVALID:
    "Slack didn't accept this webhook. Check that you copied the whole URL and that the webhook still exists.",
  // "Send test message": Slack refuses the saved webhook (removed in Slack, or its channel archived)
  SLACK_WEBHOOK_REMOVED:
    "Slack didn't accept the message. The webhook may have been removed in Slack: edit the Slack channel and paste a new webhook URL.",
  NEWS_SOURCE_NOT_CONFIGURED: 'No news source is set up (NEWSDATA_API_KEY is missing).',

  // Better Auth
  INVALID_EMAIL_OR_PASSWORD: 'Invalid email or password.',
  USER_ALREADY_EXISTS: 'An account with this email already exists.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'An account with this email already exists.',
  USERNAME_IS_ALREADY_TAKEN: 'This username is already taken.',
  // Admin plugin: a disabled user tries to log in
  BANNED_USER: 'Your account has been disabled. Please contact support.',
} as const;
