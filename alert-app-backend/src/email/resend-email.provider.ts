import { Resend } from 'resend';
import { EmailProvider, type EmailMessage } from './email-provider.js';

/** Sends through Resend (https://resend.com/docs/api-reference/emails/send-email). */
export class ResendEmailProvider extends EmailProvider {
  private readonly resend: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    super();
    this.resend = new Resend(apiKey);
  }

  async send(message: EmailMessage): Promise<void> {
    // The SDK doesn't throw on API errors: it returns them in `error`
    const { error } = await this.resend.emails.send({ from: this.from, ...message });
    if (error) throw new Error(`Resend: ${error.name}: ${error.message}`);
  }
}
