import type { ChannelType } from '@alert-app/shared';
import type { Language } from '../i18n/i18n.js';

/** Who and where a message goes to: the channel's settings and its owner. */
export interface ChannelTarget {
  /** The channel's `config` column. Checked with `validateConfig()` before use. */
  config: unknown;
  user: { email: string; name: string };
}

/** One article in an alert message. */
export interface AlertArticle {
  title: string;
  url: string;
  description: string | null;
  /** The publisher, e.g. "Ciodive" */
  sourceName: string | null;
  publishedAt: Date;
}

/**
 * What to send, independent of the channel: each channel turns it into its own format
 * (an HTML email, a Slack message, ...).
 * - `test`: the "Send test message" button
 * - `alert`: the new articles one rule matched in one fetch
 */
export type ChannelMessage =
  | { kind: 'test' }
  | {
      kind: 'alert';
      ruleName: string;
      /** Newest first */
      articles: AlertArticle[];
      /** The alerts page in the app, for "Manage your alerts" */
      alertsUrl: string;
    };

/**
 * One way of sending alerts. Adding a channel type (Slack in milestone 7) = one class that
 * implements this, registered in ChannelsModule.
 */
export interface NotificationChannel {
  readonly type: ChannelType;
  /** Throws when the stored `config` doesn't have this type's shape. */
  validateConfig(config: unknown): void;
  /** What the Channels page shows, e.g. the email address. */
  destination(target: ChannelTarget): string;
  /** Throws when sending fails. */
  send(target: ChannelTarget, message: ChannelMessage, language: Language): Promise<void>;
}

/** Injection token for the list of all channel types (an interface can't be one, see EmailProvider). */
export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');
