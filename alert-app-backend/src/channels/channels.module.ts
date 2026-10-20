import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { EmailModule } from '../email/email.module.js';
import { ChannelsController } from './channels.controller.js';
import { ChannelsService } from './channels.service.js';
import { EmailChannel } from './email/email.channel.js';
import { NOTIFICATION_CHANNELS, type NotificationChannel } from './notification-channel.js';
import { SlackChannel } from './slack/slack.channel.js';
import {
  FetchSlackWebhookClient,
  LogSlackWebhookClient,
  SlackWebhookClient,
} from './slack/slack-webhook-client.js';

@Module({
  imports: [EmailModule],
  controllers: [ChannelsController],
  providers: [
    ChannelsService,
    EmailChannel,
    SlackChannel,
    {
      // Real Slack posts, unless SLACK_ENABLED=false (then only the log, e.g. in the e2e tests)
      provide: SlackWebhookClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): SlackWebhookClient => {
        if (!config.get('SLACK_ENABLED', { infer: true })) {
          new Logger(ChannelsModule.name).warn(
            'SLACK_ENABLED=false: Slack messages are only logged.',
          );
          return new LogSlackWebhookClient();
        }
        return new FetchSlackWebhookClient();
      },
    },
    {
      // Every channel type. A new type: add its class to providers, inject and this list.
      provide: NOTIFICATION_CHANNELS,
      inject: [EmailChannel, SlackChannel],
      useFactory: (email: EmailChannel, slack: SlackChannel): NotificationChannel[] => [
        email,
        slack,
      ],
    },
  ],
  // AlertRulesService checks that a rule's channels are the user's own
  exports: [ChannelsService],
})
export class ChannelsModule {}
