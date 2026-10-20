import { Logger } from '@nestjs/common';
import { EmailProvider, type EmailMessage } from './email-provider.js';

/**
 * Used when RESEND_API_KEY is not set (local work, tests): writes the email to the backend log
 * instead of sending it, so nothing uses the email quota.
 */
export class LogEmailProvider extends EmailProvider {
  private readonly logger = new Logger(LogEmailProvider.name);

  send(message: EmailMessage): Promise<void> {
    this.logger.log(`Email to ${message.to}: "${message.subject}"\n${message.text}`);
    return Promise.resolve();
  }
}
