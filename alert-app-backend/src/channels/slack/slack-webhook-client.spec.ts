import { PermanentSendError } from '../../errors/permanent-send-error.js';
import type { SlackPayload } from './slack-messages.js';
import { FetchSlackWebhookClient, SLACK_TIMEOUT_MS } from './slack-webhook-client.js';

// A made-up URL in Slack's format, not a real webhook (Slack's own example has the shape of a
// real secret, so GitHub's push protection blocks it). No request leaves the test: fetch is faked.
const webhookUrl = 'https://hooks.slack.com/services/TEXAMPLE/BEXAMPLE/notarealsecret';
const payload: SlackPayload = { text: 'Hi', blocks: [] };
const fetchMock = vi.fn<typeof fetch>();

describe('FetchSlackWebhookClient', () => {
  const client = new FetchSlackWebhookClient();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('posts the message as JSON, with a timeout', async () => {
    fetchMock.mockResolvedValue(new Response('ok', { status: 200 }));

    await client.post(webhookUrl, payload);

    expect(fetchMock).toHaveBeenCalledWith(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: expect.any(AbortSignal) as AbortSignal,
    });
    expect(SLACK_TIMEOUT_MS).toBe(10_000);
  });

  // e.g. the webhook was removed, the channel archived, posting is not allowed
  it.each([
    [404, 'no_service'],
    [410, 'channel_is_archived'],
    [403, 'action_prohibited'],
    [400, 'invalid_payload'],
  ])('fails for good when Slack answers %i %s (no retry)', async (status, code) => {
    fetchMock.mockResolvedValue(new Response(code, { status }));

    const error = await client.post(webhookUrl, payload).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PermanentSendError);
    expect(error).toHaveProperty('message', `Slack: ${status} ${code}`);
  });

  it.each([
    [429, 'rate_limited'],
    [500, 'internal_error'],
    [503, ''],
  ])('fails for now when Slack answers %i (retried)', async (status, code) => {
    fetchMock.mockResolvedValue(new Response(code, { status }));

    const error = await client.post(webhookUrl, payload).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(PermanentSendError);
  });

  it('fails for now on a network error or timeout, without the URL in the message', async () => {
    fetchMock.mockRejectedValue(new DOMException(`Timeout for ${webhookUrl}`, 'TimeoutError'));

    const error = await client.post(webhookUrl, payload).catch((e: unknown) => e);

    expect(error).not.toBeInstanceOf(PermanentSendError);
    expect(error).toHaveProperty('message', 'Slack: the request failed (TimeoutError)');
  });

  it('never puts the webhook URL into an error message (it is a secret)', async () => {
    fetchMock.mockResolvedValue(
      new Response(`no_service ${webhookUrl}`.repeat(3), { status: 404 }),
    );

    const error = await client.post(webhookUrl, payload).catch((e: unknown) => e);

    expect((error as Error).message).not.toContain('notarealsecret');
  });
});
