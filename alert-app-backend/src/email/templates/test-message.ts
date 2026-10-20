import { translateEmail, type Language } from '../../i18n/i18n.js';
import type { EmailMessage } from '../email-provider.js';
import { emailLayout, escapeHtml, paragraph } from './layout.js';

/** "Your Alert App email channel works", sent from the Channels page. */
export function testMessageEmail({
  language,
  to,
  name,
}: {
  language: Language;
  to: string;
  name: string;
}): EmailMessage {
  const t = (key: string, values?: Record<string, string>) => translateEmail(language, key, values);
  // HTML gets escaped values, the plain text the values as they are
  const htmlT = (key: string, values: Record<string, string> = {}) =>
    t(key, Object.fromEntries(Object.entries(values).map(([k, v]) => [k, escapeHtml(v)])));

  const subject = t('test.subject');
  const footer = t('footer');

  return {
    to,
    subject,
    text: [
      t('test.greeting', { name }),
      t('test.body', { email: to }),
      t('test.noAction'),
      '--',
      footer,
    ].join('\n\n'),
    html: emailLayout({
      language,
      appName: t('appName'),
      title: subject,
      footer,
      content: [
        paragraph(htmlT('test.greeting', { name })),
        paragraph(htmlT('test.body', { email: to })),
        paragraph(escapeHtml(t('test.noAction'))),
      ].join('\n'),
    }),
  };
}
