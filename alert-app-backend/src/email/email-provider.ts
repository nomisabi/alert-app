/** One email, ready to send. */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  /** Plain-text version, for email apps that don't show HTML (and for spam filters). */
  text: string;
}

/**
 * Sends emails. Switching to another service (SendGrid, Mailgun, SES) = one new class.
 *
 * An abstract class, not an interface: TypeScript interfaces don't exist at runtime, so Nest
 * couldn't use one to find the provider. The class works as the injection token, e.g.
 * `constructor(private readonly email: EmailProvider)`.
 */
export abstract class EmailProvider {
  /** Throws when the email could not be sent. */
  abstract send(message: EmailMessage): Promise<void>;
}
