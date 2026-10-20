import { tz } from '@date-fns/tz';
import { format } from 'date-fns';
import { isWebLink, shortenDescription } from '../../channels/article-text.js';
import type { AlertArticle } from '../../channels/notification-channel.js';
import { translateEmail, type Language } from '../../i18n/i18n.js';
import type { EmailMessage } from '../email-provider.js';
import { emailLayout, escapeHtml, paragraph } from './layout.js';

/** "The new articles of your alert", one email per rule and fetch. */
export function alertEmail({
  language,
  to,
  name,
  ruleName,
  articles,
  alertsUrl,
}: {
  language: Language;
  to: string;
  name: string;
  ruleName: string;
  articles: AlertArticle[];
  alertsUrl: string;
}): EmailMessage {
  const t = (key: string, values?: Record<string, string | number>) =>
    translateEmail(language, key, values);
  // HTML gets escaped values, the plain text the values as they are
  const htmlT = (key: string, values: Record<string, string | number> = {}) =>
    t(
      key,
      Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, typeof v === 'string' ? escapeHtml(v) : v]),
      ),
    );

  const count = articles.length;
  const subject = t('alert.subject', { count, rule: ruleName });
  const footer = t('footer');

  /** "Ciodive · Oct 19, 2026, 8:21 PM UTC" */
  const meta = (article: AlertArticle, translate: typeof t) => {
    const date = format(article.publishedAt, t('alert.dateFormat'), { in: tz('UTC') });
    return article.sourceName
      ? translate('alert.meta', { source: article.sourceName, date })
      : translate('alert.metaWithoutSource', { date });
  };

  const textArticles = articles.map((article) =>
    [
      article.title,
      meta(article, t),
      article.description ? shortenDescription(article.description) : undefined,
      article.url,
    ]
      .filter(Boolean)
      .join('\n'),
  );

  const htmlArticles = articles.map((article) => {
    const title = escapeHtml(article.title);
    const titleHtml = isWebLink(article.url)
      ? `<a href="${escapeHtml(article.url)}" style="color:#1565c0;text-decoration:underline;">${title}</a>`
      : title;
    return `<div style="margin:0 0 24px;">
        <p style="margin:0 0 4px;font-size:17px;line-height:24px;font-weight:bold;">${titleHtml}</p>
        <p style="margin:0 0 8px;font-size:13px;line-height:18px;color:#4b5563;">${meta(article, htmlT)}</p>
        ${article.description ? `<p style="margin:0;font-size:15px;line-height:22px;color:#1f2937;">${escapeHtml(shortenDescription(article.description))}</p>` : ''}
      </div>`;
  });

  return {
    to,
    subject,
    text: [
      t('alert.greeting', { name }),
      t('alert.intro', { count, rule: ruleName }),
      ...textArticles,
      `${t('alert.manage')}: ${alertsUrl}`,
      '--',
      footer,
    ].join('\n\n'),
    html: emailLayout({
      language,
      appName: t('appName'),
      title: subject,
      footer,
      content: [
        paragraph(htmlT('alert.greeting', { name })),
        paragraph(htmlT('alert.intro', { count, rule: ruleName })),
        ...htmlArticles,
        paragraph(
          `<a href="${escapeHtml(alertsUrl)}" style="color:#1565c0;">${escapeHtml(t('alert.manage'))}</a>`,
        ),
      ].join('\n'),
    }),
  };
}
