import { slackChannelConfigSchema, type SlackChannelConfig } from '@alert-app/shared';
import { Injectable } from '@nestjs/common';
import type { Language } from '../../i18n/i18n.js';
import type {
  ChannelMessage,
  ChannelTarget,
  NotificationChannel,
} from '../notification-channel.js';
import { slackMessage } from './slack-messages.js';
import { SlackWebhookClient } from './slack-webhook-client.js';

/**
 * Posts to a Slack channel through an incoming webhook (the user pasted its URL).
 * `config` = { name, webhookUrl }: the name is what the app shows, the URL is a secret.
 */
@Injectable()
export class SlackChannel implements NotificationChannel {
  readonly type = 'slack';

  constructor(private readonly client: SlackWebhookClient) {}

  validateConfig(config: unknown): void {
    this.config(config);
  }

  /** The name the user gave it, e.g. "#news in Acme". Never the URL. */
  destination(target: ChannelTarget): string {
    return this.config(target.config).name;
  }

  async send(target: ChannelTarget, message: ChannelMessage, language: Language): Promise<void> {
    const { webhookUrl } = this.config(target.config);
    await this.client.post(webhookUrl, slackMessage(message, language));
  }

  private config(config: unknown): SlackChannelConfig {
    // Zod's error lists the broken fields and rules, not the values, so the URL stays out of it
    return slackChannelConfigSchema.parse(config);
  }
}
