/** Texts of the Slack messages we post (the `slack` i18n namespace). */
export const slackEn = {
  test: {
    text: 'Alert App is connected',
    body: 'This is a test message from *Alert App*. Alerts that use this channel are posted here.',
  },
  // _one/_other: i18next picks one by {{count}}
  alert: {
    // The header and the notification text (Slack shows it in phone notifications)
    title_one: 'New article for your alert “{{rule}}”',
    title_other: '{{count}} new articles for your alert “{{rule}}”',
    // Under each title. The date is in UTC (users have no time zone setting yet).
    meta: '{{source}} · {{date}}',
    metaWithoutSource: '{{date}}',
    dateFormat: "MMM d, yyyy, h:mm a 'UTC'",
    // When a fetch found more articles than one message shows
    more_one: '…and {{count}} more article.',
    more_other: '…and {{count}} more articles.',
    manage: 'Manage your alerts',
  },
} as const;
