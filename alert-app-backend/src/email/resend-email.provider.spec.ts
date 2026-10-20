import { PermanentSendError } from '../errors/permanent-send-error.js';
import { ResendEmailProvider } from './resend-email.provider.js';

// The Resend SDK, replaced by a fake: no request leaves the test
const sendMock = vi.hoisted(() => vi.fn());
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

const message = { to: 'ann@example.com', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' };
const resendError = (statusCode: number | null) => ({
  data: null,
  error: { name: 'validation_error', message: 'Invalid `to` field', statusCode },
});

describe('ResendEmailProvider', () => {
  const provider = new ResendEmailProvider('re_test', 'Alert App <onboarding@resend.dev>');

  beforeEach(() => sendMock.mockReset());

  it('sends from the configured sender', async () => {
    sendMock.mockResolvedValue({ data: { id: 'email-1' }, error: null });

    await provider.send(message);

    expect(sendMock).toHaveBeenCalledWith({
      from: 'Alert App <onboarding@resend.dev>',
      ...message,
    });
  });

  it('throws a permanent error when Resend refuses the email (4xx)', async () => {
    for (const statusCode of [403, 422]) {
      sendMock.mockResolvedValue(resendError(statusCode));

      const error = await provider.send(message).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(PermanentSendError);
      expect(error).toMatchObject({
        message: 'Resend: validation_error: Invalid `to` field',
      });
    }
  });

  it('throws a temporary error for rate limits, Resend problems and unknown errors', async () => {
    for (const statusCode of [429, 500, null]) {
      sendMock.mockResolvedValue(resendError(statusCode));

      const error = await provider.send(message).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(PermanentSendError);
    }
  });
});
