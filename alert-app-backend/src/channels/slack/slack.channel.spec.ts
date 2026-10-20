import { SlackChannel } from './slack.channel.js';
import type { SlackWebhookClient } from './slack-webhook-client.js';

const webhookUrl = 'https://hooks.slack.com/services/TEXAMPLE/BEXAMPLE/notarealsecret';
const target = (config: unknown) => ({
  config,
  user: { email: 'ann@example.com', name: 'Ann' },
});

describe('SlackChannel', () => {
  const post = vi.fn<SlackWebhookClient['post']>();
  const channel = new SlackChannel({ post });

  beforeEach(() => post.mockReset().mockResolvedValue());

  it('shows the name the user gave it, never the URL', () => {
    expect(channel.destination(target({ name: '#news in Acme', webhookUrl }))).toBe(
      '#news in Acme',
    );
  });

  it('posts the message to the webhook', async () => {
    await channel.send(target({ name: '#news', webhookUrl }), { kind: 'test' }, 'en');

    expect(post).toHaveBeenCalledWith(webhookUrl, {
      text: 'Alert App is connected',
      blocks: [expect.objectContaining({ type: 'section' })],
    });
  });

  it('refuses a config that is not a Slack config, without the value in the error', () => {
    const notSlack = { name: '#news', webhookUrl: 'https://example.com/secret-path' };

    expect(() => channel.validateConfig({})).toThrow();
    expect(() => channel.validateConfig(notSlack)).toThrow(/slackWebhookUrl\.invalid/);
    expect(() => channel.validateConfig(notSlack)).not.toThrow(/secret-path/);
    expect(() => channel.validateConfig({ name: '#news', webhookUrl })).not.toThrow();
  });

  it('never posts with a broken config', async () => {
    await expect(
      channel.send(target({ webhookUrl: 'https://example.com/x' }), { kind: 'test' }, 'en'),
    ).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
  });
});
