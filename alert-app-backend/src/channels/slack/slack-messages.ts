import { tz } from '@date-fns/tz';
import { format } from 'date-fns';
import { translateSlack, type Language } from '../../i18n/i18n.js';
import { isWebLink, shortenDescription } from '../article-text.js';
import type { AlertArticle, ChannelMessage } from '../notification-channel.js';

// Slack messages are JSON "blocks" (Block Kit, https://docs.slack.dev/block-kit). We only use a
// few kinds, so these small types are enough (no Slack SDK needed).
export type SlackBlock =
  | { type: 'header'; text: { type: 'plain_text'; text: string } }
  | { type: 'section'; text: { type: 'mrkdwn'; text: string } }
  | { type: 'context'; elements: { type: 'mrkdwn'; text: string }[] }
  | { type: 'divider' };

/** The body posted to a webhook. `text` is shown in notifications and where blocks can't be. */
export interface SlackPayload {
  text: string;
  blocks: SlackBlock[];
}

/** Slack allows 50 blocks per message; one article is one block, so 15 leaves plenty of room. */
export const SLACK_ARTICLES_MAX = 15;
/** Slack's limit for a header block. */
const HEADER_MAX_LENGTH = 150;
/** A section allows 3,000 characters; titles are short, but a provider could send anything. */
const TITLE_MAX_LENGTH = 250;

/**
 * Slack's "mrkdwn" gives &, < and > a meaning (`<url|text>` is a link), so they are escaped in
 * every text from outside (titles, descriptions, rule names). Like escapeHtml() for emails.
 */
export function escapeSlack(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** A URL inside `<url|text>`: `|` and `>` would end it early, so they are percent-encoded. */
function linkTarget(url: string): string {
  return escapeSlack(url).replace(/\|/g, '%7C');
}

function cut(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

const section = (text: string): SlackBlock => ({ type: 'section', text: { type: 'mrkdwn', text } });
/** Small grey text. */
const context = (text: string): SlackBlock => ({
  type: 'context',
  elements: [{ type: 'mrkdwn', text }],
});

/** Turns a channel-independent message into a Slack message. */
export function slackMessage(message: ChannelMessage, language: Language): SlackPayload {
  const t = (key: string, values?: Record<string, string | number>) =>
    translateSlack(language, key, values);

  switch (message.kind) {
    case 'test':
      return { text: t('test.text'), blocks: [section(t('test.body'))] };
    case 'alert':
      return alertMessage(message, t);
  }
}

function alertMessage(
  { ruleName, articles, alertsUrl }: Extract<ChannelMessage, { kind: 'alert' }>,
  t: (key: string, values?: Record<string, string | number>) => string,
): SlackPayload {
  const count = articles.length;
  const title = t('alert.title', { count, rule: ruleName });
  const hidden = count - SLACK_ARTICLES_MAX;

  /** "*<url|Title>*", then "Source · date" and the shortened description on their own lines. */
  const articleBlock = (article: AlertArticle): SlackBlock => {
    const text = escapeSlack(cut(article.title, TITLE_MAX_LENGTH));
    const link = isWebLink(article.url) ? `<${linkTarget(article.url)}|${text}>` : text;
    const date = format(article.publishedAt, t('alert.dateFormat'), { in: tz('UTC') });
    const meta = article.sourceName
      ? t('alert.meta', { source: escapeSlack(article.sourceName), date })
      : t('alert.metaWithoutSource', { date });
    const description = article.description
      ? escapeSlack(shortenDescription(article.description))
      : undefined;
    return section([`*${link}*`, meta, description].filter(Boolean).join('\n'));
  };

  return {
    text: escapeSlack(title),
    blocks: [
      // A header is plain text (no mrkdwn), so the rule name isn't escaped there
      { type: 'header', text: { type: 'plain_text', text: cut(title, HEADER_MAX_LENGTH) } },
      ...articles.slice(0, SLACK_ARTICLES_MAX).map(articleBlock),
      ...(hidden > 0 ? [context(t('alert.more', { count: hidden }))] : []),
      { type: 'divider' },
      section(`<${linkTarget(alertsUrl)}|${t('alert.manage')}>`),
    ],
  };
}
