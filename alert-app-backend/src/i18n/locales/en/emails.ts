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
} as const;
