import type { ApiError } from '@alert-app/shared';
import { screen, within } from '@testing-library/react';
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

/** Answers like the backend. `fail` answers one request with an error instead. */
function serve(fail?: (method: string, path: string) => [number, ApiError] | undefined) {
  vi.mocked(orvalFetch).mockImplementation((url: string, init: RequestInit) => {
    const method = init.method ?? 'GET';
    const path = new URL(url, 'http://localhost').pathname;

    const error = fail?.(method, path);
    if (error) return Promise.reject(new ApiRequestError(...error));

    // POST .../test answers 204 without a body
    return Promise.resolve(method === 'GET' ? { items: [email] } : undefined);
  });
}

/** The requests that change something (no GETs). */
const sentRequests = () =>
  vi
    .mocked(orvalFetch)
    .mock.calls.filter(([, init]) => init.method && init.method !== 'GET')
    .map(([url, init]) => `${init.method} ${url}`);

describe('ChannelsPage', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue(testSession());
  });

  it('lists my channels with where they send to', async () => {
    serve();
    renderRoute('/channels');

    const list = await screen.findByRole('list', { name: 'Your channels' });
    const card = within(list).getByRole('listitem');
    expect(within(card).getByRole('heading', { name: 'Email' })).toBeInTheDocument();
    expect(within(card).getByText('test@example.com')).toBeInTheDocument();
    // The visible text is the same on every card, the accessible name says which channel
    expect(
      within(card).getByRole('button', { name: 'Send a test message to Email test@example.com' }),
    ).toHaveTextContent('Send test message');
  });

  it('sends a test message and says so', async () => {
    const user = userEvent.setup();
    serve();
    renderRoute('/channels');

    await user.click(await screen.findByRole('button', { name: /send a test message/i }));

    expect(await screen.findByText('Test message sent to test@example.com.')).toBeInTheDocument();
    expect(sentRequests()).toEqual(['POST /api/channels/channel-1/test']);
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
