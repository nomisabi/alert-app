import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module.js';
import { ChannelsController } from './channels.controller.js';
import { ChannelsService } from './channels.service.js';
import { EmailChannel } from './email/email.channel.js';
import { NOTIFICATION_CHANNELS, type NotificationChannel } from './notification-channel.js';

@Module({
  imports: [EmailModule],
  controllers: [ChannelsController],
  providers: [
    ChannelsService,
    EmailChannel,
    {
      // Every channel type. Slack (milestone 7): add SlackChannel to providers, inject and this list.
      provide: NOTIFICATION_CHANNELS,
      inject: [EmailChannel],
      useFactory: (email: EmailChannel): NotificationChannel[] => [email],
    },
  ],
  // AlertRulesService checks that a rule's channels are the user's own
  exports: [ChannelsService],
})
export class ChannelsModule {}
