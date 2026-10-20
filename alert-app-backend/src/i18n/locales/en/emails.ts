/** Texts of the emails we send (the `emails` i18n namespace). */
export const emailsEn = {
  appName: 'Alert App',
  footer: 'Alert App · You can change your alerts and channels in the app.',
  test: {
    subject: 'Your Alert App email channel works',
    greeting: 'Hi {{name}},',
    body: 'This is a test message from Alert App. Alerts that use this channel are sent to {{email}}.',
    noAction: 'You sent this test from the Channels page. You don’t need to do anything.',
  },
  // _one/_other: i18next picks one by {{count}}
  alert: {
    subject_one: 'New article for your alert “{{rule}}”',
    subject_other: '{{count}} new articles for your alert “{{rule}}”',
    greeting: 'Hi {{name}},',
    intro_one: 'Your alert “{{rule}}” found a new article:',
    intro_other: 'Your alert “{{rule}}” found {{count}} new articles:',
    // Under each title. The date is in UTC (users have no time zone setting yet).
    meta: '{{source}} · {{date}}',
    metaWithoutSource: '{{date}}',
    dateFormat: "MMM d, yyyy, h:mm a 'UTC'",
    manage: 'Manage your alerts',
  },
} as const;
