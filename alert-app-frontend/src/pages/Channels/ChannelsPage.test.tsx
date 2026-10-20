import type { ApiError, Channel } from '@alert-app/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, orvalFetch } from '../../global/utils/apiFetch';
import { getSession } from '../../global/utils/authApi';
import { testChannel, testSession } from '../../test/fixtures';
import { renderRoute } from '../../test/renderWithProviders';

// The generated Orval code sends every request through orvalFetch. Faking it (and nothing else)
// tests the real generated hooks, our hooks in api/channels/ and the query cache.
vi.mock('../../global/utils/apiFetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../global/utils/apiFetch')>()),
  orvalFetch: vi.fn(),
}));

const email = testChannel();

/**
 * A small in-memory backend: keeps the channels, so the reload after connecting or editing shows
 * the new state. `fail` answers one request with an error instead.
 */
function serve(fail?: (method: string, path: string) => [number, ApiError] | undefined) {
  let channels: Channel[] = [email];

  vi.mocked(orvalFetch).mockImplementation((url: string, init: RequestInit) => {
    const method = init.method ?? 'GET';
    const path = new URL(url, 'http://localhost').pathname;
    const body = init.body ? (JSON.parse(init.body as string) as Record<string, string>) : {};

    const error = fail?.(method, path);
    if (error) return Promise.reject(new ApiRequestError(...error));

    if (method === 'POST' && path === '/api/channels') {
      // Like the server: the response has the name as `destination`, never the URL
      const slack = testChannel({ id: 'channel-2', type: 'slack', destination: body.name });
      channels = [...channels, slack];
      return Promise.resolve(slack);
    }
    if (method === 'PATCH') {
      const id = path.split('/').at(-1);
      channels = channels.map((channel) =>
        channel.id === id ? { ...channel, destination: body.name ?? channel.destination } : channel,
      );
      return Promise.resolve(channels.find((channel) => channel.id === id));
    }
    // POST .../test answers 204 without a body
    return Promise.resolve(method === 'GET' ? { items: channels } : undefined);
  });
}

/** The requests that change something (no GETs), e.g. "POST /api/channels". */
const sentRequests = () =>
  vi
    .mocked(orvalFetch)
    .mock.calls.filter(([, init]) => init.method && init.method !== 'GET')
    .map(([url, init]) => `${init.method} ${url}`);

/** The body of the last request that changed something. */
const lastBody = () => {
  const changes = vi
    .mocked(orvalFetch)
    .mock.calls.filter(([, init]) => init.method && init.method !== 'GET');
  return JSON.parse(changes.at(-1)![1].body as string) as unknown;
};

const slackWebhookUrl = 'https://hooks.slack.com/services/TEXAMPLE/BEXAMPLE/notarealsecret';

/** Connects Slack as "#news in Acme" through the dialog. */
async function connectSlack(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Connect Slack' }));
  const dialog = await screen.findByRole('dialog', { name: 'Connect Slack' });
  await user.type(within(dialog).getByRole('textbox', { name: /name/i }), '#news in Acme');
  await user.type(within(dialog).getByRole('textbox', { name: /webhook url/i }), slackWebhookUrl);
  await user.click(within(dialog).getByRole('button', { name: 'Connect' }));
}

/** The Slack card (second in the list), once no dialog covers the page. */
async function findSlackCard() {
  // MUI keeps a closing dialog in the page while it fades out; the page is usable after that
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  const list = screen.getByRole('list', { name: 'Your channels' });
  return within(list).getAllByRole('listitem')[1];
}

describe('ChannelsPage', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue(testSession());
  });

  it('lists my channels with where they send to', async () => {
    serve();
    renderRoute('/channels');

    const list = await screen.findByRole('list', { name: 'Your channels' });
    const [card] = within(list).getAllByRole('listitem');
    expect(within(card).getByRole('heading', { name: 'Email' })).toBeInTheDocument();
    expect(within(card).getByText('test@example.com')).toBeInTheDocument();
    // The visible text is the same on every card, the accessible name says which channel
    expect(
      within(card).getByRole('button', { name: 'Send a test message to Email test@example.com' }),
    ).toHaveTextContent('Send test message');
  });

  it('shows a Slack card with "Connect Slack" while Slack is not connected', async () => {
    serve();
    renderRoute('/channels');

    const list = await screen.findByRole('list', { name: 'Your channels' });
    const [, slackCard] = within(list).getAllByRole('listitem');
    expect(within(slackCard).getByRole('heading', { name: 'Slack' })).toBeInTheDocument();
    expect(within(slackCard).getByText('Not connected')).toBeInTheDocument();
    expect(within(slackCard).getByRole('button', { name: 'Connect Slack' })).toBeInTheDocument();
  });

  it('checks the Connect Slack form: required fields, only Slack webhook URLs', async () => {
    const user = userEvent.setup();
    serve();
    renderRoute('/channels');

    await user.click(await screen.findByRole('button', { name: 'Connect Slack' }));
    const dialog = await screen.findByRole('dialog', { name: 'Connect Slack' });
    expect(
      within(dialog).getByRole('link', { name: /slack's guide to incoming webhooks/i }),
    ).toHaveAttribute('target', '_blank');

    await user.click(within(dialog).getByRole('button', { name: 'Connect' }));
    expect(await within(dialog).findByText('Enter a name for this channel.')).toBeInTheDocument();
    expect(within(dialog).getByText('Paste the webhook URL from Slack.')).toBeInTheDocument();

    await user.type(
      within(dialog).getByRole('textbox', { name: /webhook url/i }),
      'https://example.com/x',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Connect' }));
    expect(
      await within(dialog).findByText(
        'Paste a Slack webhook URL. It starts with https://hooks.slack.com/services/',
      ),
    ).toBeInTheDocument();
    expect(sentRequests()).toEqual([]);
  });

  it('connects Slack: the Slack card then shows the name and "Send test message"', async () => {
    const user = userEvent.setup();
    serve();
    renderRoute('/channels');

    await connectSlack(user);

    expect(
      await screen.findByText('Slack connected. A test message was sent to #news in Acme.'),
    ).toBeInTheDocument();
    const slackCard = await findSlackCard();
    expect(within(slackCard).getByText('#news in Acme')).toBeInTheDocument();
    expect(
      within(slackCard).getByRole('button', { name: 'Send a test message to Slack #news in Acme' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect Slack' })).not.toBeInTheDocument();
    expect(sentRequests()).toEqual(['POST /api/channels']);
    expect(lastBody()).toEqual({
      type: 'slack',
      name: '#news in Acme',
      webhookUrl: slackWebhookUrl,
    });
  });

  it("shows Slack's rejection under the URL field and keeps the dialog open", async () => {
    const user = userEvent.setup();
    const message = "Slack didn't accept this webhook.";
    serve((method, path) =>
      method === 'POST' && path === '/api/channels'
        ? [
            400,
            {
              code: 'SLACK_WEBHOOK_INVALID',
              message,
              fieldErrors: [{ field: 'webhookUrl', message }],
            },
          ]
        : undefined,
    );
    renderRoute('/channels');

    await connectSlack(user);

    const dialog = screen.getByRole('dialog', { name: 'Connect Slack' });
    expect(await within(dialog).findByText(message)).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: /webhook url/i })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('shows a Slack outage above the buttons, keeps the dialog open and the typed values', async () => {
    const user = userEvent.setup();
    const message = "We couldn't send the test message. Please try again later.";
    serve((method, path) =>
      method === 'POST' && path === '/api/channels'
        ? [502, { code: 'CHANNEL_TEST_FAILED', message }]
        : undefined,
    );
    renderRoute('/channels');

    await connectSlack(user);

    const dialog = screen.getByRole('dialog', { name: 'Connect Slack' });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message);
    expect(within(dialog).getByRole('textbox', { name: /webhook url/i })).toHaveValue(
      slackWebhookUrl,
    );
    expect(screen.queryByText(/Slack connected/)).not.toBeInTheDocument();
  });

  it('cancels without sending anything; the dialog starts empty again', async () => {
    const user = userEvent.setup();
    serve();
    renderRoute('/channels');

    await user.click(await screen.findByRole('button', { name: 'Connect Slack' }));
    let dialog = await screen.findByRole('dialog', { name: 'Connect Slack' });
    await user.type(within(dialog).getByRole('textbox', { name: /name/i }), '#typed');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Connect Slack' }));
    dialog = await screen.findByRole('dialog', { name: 'Connect Slack' });
    expect(within(dialog).getByRole('textbox', { name: /name/i })).toHaveValue('');
    expect(sentRequests()).toEqual([]);
  });

  it('edits Slack: the name starts filled in, an empty URL keeps the current one', async () => {
    const user = userEvent.setup();
    serve();
    renderRoute('/channels');
    await connectSlack(user);

    await user.click(
      within(await findSlackCard()).getByRole('button', { name: 'Edit Slack #news in Acme' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Edit Slack' });
    const name = within(dialog).getByRole('textbox', { name: /name/i });
    const url = within(dialog).getByRole('textbox', { name: /webhook url/i });
    expect(name).toHaveValue('#news in Acme');
    // The API never returns the URL, so the field starts empty
    expect(url).toHaveValue('');
    expect(
      within(dialog).getByText('Leave empty to keep the current webhook URL.'),
    ).toBeInTheDocument();

    await user.type(url, 'https://example.com/x');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(
      await within(dialog).findByText(
        'Paste a Slack webhook URL. It starts with https://hooks.slack.com/services/',
      ),
    ).toBeInTheDocument();

    await user.clear(url);
    await user.clear(name);
    await user.type(name, '#alerts');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Slack updated.')).toBeInTheDocument();
    expect(within(await findSlackCard()).getByText('#alerts')).toBeInTheDocument();
    // Only the name: the URL stays as it is on the server
    expect(sentRequests().at(-1)).toBe('PATCH /api/channels/channel-2');
    expect(lastBody()).toEqual({ name: '#alerts' });
  });

  it('sends a new webhook URL when one is typed (the server tests it)', async () => {
    const user = userEvent.setup();
    serve();
    renderRoute('/channels');
    await connectSlack(user);

    await user.click(
      within(await findSlackCard()).getByRole('button', { name: 'Edit Slack #news in Acme' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Edit Slack' });
    const newUrl = slackWebhookUrl.replace('BEXAMPLE', 'BEXAMPLE2');
    await user.type(within(dialog).getByRole('textbox', { name: /webhook url/i }), newUrl);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Slack updated. A test message was sent to #news in Acme.'),
    ).toBeInTheDocument();
    expect(lastBody()).toEqual({ name: '#news in Acme', webhookUrl: newUrl });
  });

  it('sends a test message and says so', async () => {
    const user = userEvent.setup();
    serve();
    renderRoute('/channels');

    await user.click(await screen.findByRole('button', { name: /send a test message/i }));

    expect(await screen.findByText('Test message sent to test@example.com.')).toBeInTheDocument();
    expect(sentRequests()).toEqual(['POST /api/channels/channel-1/test']);
  });

  it('sends a test message to Slack from the Slack card', async () => {
    const user = userEvent.setup();
    serve();
    renderRoute('/channels');
    await connectSlack(user);

    await user.click(
      within(await findSlackCard()).getByRole('button', {
        name: 'Send a test message to Slack #news in Acme',
      }),
    );

    expect(await screen.findByText('Test message sent to #news in Acme.')).toBeInTheDocument();
    expect(sentRequests()).toEqual(['POST /api/channels', 'POST /api/channels/channel-2/test']);
  });

  it("shows the server's message when it's too soon for another test", async () => {
    const user = userEvent.setup();
    const tooSoon = 'You can send one test message per minute. Please try again in 42 seconds.';
    serve((method) =>
      method === 'POST' ? [429, { code: 'CHANNEL_TEST_TOO_SOON', message: tooSoon }] : undefined,
    );
    renderRoute('/channels');

    await user.click(await screen.findByRole('button', { name: /send a test message/i }));

    expect(await screen.findByText(tooSoon)).toBeInTheDocument();
  });

  it('shows an error with "Try again" when the list does not load', async () => {
    const user = userEvent.setup();
    serve((method) =>
      method === 'GET' ? [500, { code: 'INTERNAL_SERVER_ERROR', message: 'Boom' }] : undefined,
    );
    renderRoute('/channels');

    expect(await screen.findByText('Your channels could not be loaded.')).toBeInTheDocument();
    serve();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Email' })).toBeInTheDocument();
  });
});
