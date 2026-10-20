import { Resend } from 'resend';
import { PermanentSendError } from '../errors/permanent-send-error.js';
import { EmailProvider, type EmailMessage } from './email-provider.js';

/**
 * Resend refused the email itself (4xx, e.g. 422 an invalid or `example.com` address, 403 an
 * address the test sender may not send to): trying again gives the same answer.
 * 429 (too many requests) and 5xx (Resend has a problem) are temporary.
 */
function isPermanent(statusCode: number | null): boolean {
  return statusCode !== null && statusCode >= 400 && statusCode < 500 && statusCode !== 429;
}

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
    if (!error) return;

    const text = `Resend: ${error.name}: ${error.message}`;
    throw isPermanent(error.statusCode) ? new PermanentSendError(text) : new Error(text);
  }
}
