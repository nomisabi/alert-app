import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { EmailProvider } from '../../email/email-provider.js';
import { testMessageEmail } from '../../email/templates/test-message.js';
import type { Language } from '../../i18n/i18n.js';
import type {
  ChannelMessage,
  ChannelTarget,
  NotificationChannel,
} from '../notification-channel.js';

// The email channel stores nothing: the address is the user's account email, read when sending,
// so it's never out of date
const emailConfigSchema = z.object({});

@Injectable()
export class EmailChannel implements NotificationChannel {
  readonly type = 'email';

  constructor(private readonly email: EmailProvider) {}

  validateConfig(config: unknown): void {
    emailConfigSchema.parse(config);
  }

  destination(target: ChannelTarget): string {
    return target.user.email;
  }

  async send(target: ChannelTarget, message: ChannelMessage, language: Language): Promise<void> {
    this.validateConfig(target.config);
    const { email, name } = target.user;

    switch (message.kind) {
      case 'test':
        return this.email.send(testMessageEmail({ language, to: email, name }));
    }
  }
}
