import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { EmailProvider } from './email-provider.js';
import { LogEmailProvider } from './log-email.provider.js';
import { ResendEmailProvider } from './resend-email.provider.js';

@Module({
  providers: [
    {
      // Whoever injects EmailProvider gets Resend when a key is configured, otherwise the log
      provide: EmailProvider,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): EmailProvider => {
        const apiKey = config.get('RESEND_API_KEY', { infer: true });
        if (!apiKey) {
          new Logger(EmailModule.name).warn('RESEND_API_KEY is not set: emails are only logged.');
          return new LogEmailProvider();
        }
        return new ResendEmailProvider(apiKey, config.get('EMAIL_FROM', { infer: true }));
      },
    },
  ],
  exports: [EmailProvider],
})
export class EmailModule {}
