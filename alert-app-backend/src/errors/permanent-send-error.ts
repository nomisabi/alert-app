/**
 * Sending can't succeed by trying again, e.g. the provider rejects the address. Thrown by
 * providers (ResendEmailProvider); the notify worker then marks the notification failed at once
 * instead of retrying. Every other error counts as temporary (network, provider down, rate limit).
 */
export class PermanentSendError extends Error {
  override readonly name = 'PermanentSendError';
}
