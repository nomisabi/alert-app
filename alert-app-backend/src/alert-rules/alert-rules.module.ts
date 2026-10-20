import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module.js';
import { AlertRulesController } from './alert-rules.controller.js';
import { AlertRulesService } from './alert-rules.service.js';

@Module({
  imports: [ChannelsModule],
  controllers: [AlertRulesController],
  providers: [AlertRulesService],
})
export class AlertRulesModule {}
