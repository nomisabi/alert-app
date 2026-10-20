import {
  ALERT_RULES_PER_USER_MAX,
  APP_CATEGORIES,
  type AlertRule,
  type ApiError,
} from '@alert-app/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, orvalFetch } from '../../global/utils/apiFetch';
import { getSession } from '../../global/utils/authApi';
import { testAlertRule, testChannel, testSession } from '../../test/fixtures';
import { renderRoute } from '../../test/renderWithProviders';

// The generated Orval code sends every request through orvalFetch. Faking it (and nothing else)
// tests the real generated hooks, our hooks in api/alert-rules/ and the query cache.
vi.mock('../../global/utils/apiFetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../global/utils/apiFetch')>()),
  orvalFetch: vi.fn(),
}));

const evNews = testAlertRule();
const sports = testAlertRule({
  id: 'rule-2',
  name: 'Sports news',
  type: 'category',
  keywords: [],
  category: 'sports',
  enabled: false,
});

interface FakeRequest {
  method: string;
  path: string;
  body: unknown;
}

/**
 * A small in-memory backend: keeps the rules, so the reload after a change shows the new state.
 * `fail` answers one request with an error instead, e.g. the rule limit.
 */
function serve(initialRules: AlertRule[], fail?: (request: FakeRequest) => ApiError | undefined) {
  let rules = [...initialRules];

  vi.mocked(orvalFetch).mockImplementation((url: string, init: RequestInit) => {
    const method = init.method ?? 'GET';
    const path = new URL(url, 'http://localhost').pathname;
    const body = init.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};

    const error = fail?.({ method, path, body });
    if (error) return Promise.reject(new ApiRequestError(400, error));

    if (path === '/api/categories') {
      return Promise.resolve({ items: APP_CATEGORIES.map((id) => ({ id })) });
    }
    if (path === '/api/channels') {
      return Promise.resolve({ items: [testChannel()] });
    }
    const id = path.split('/').at(-1);
    const changed = (rule: AlertRule, values: Record<string, unknown>): AlertRule => ({
      ...rule,
      ...values,
      ...(values.type === 'keywords' && { category: null }),
      ...(values.type === 'category' && { keywords: [] }),
    });

    switch (method) {
      case 'POST': {
        const rule = changed(testAlertRule({ id: `rule-${rules.length + 10}` }), body);
        rules = [rule, ...rules];
        return Promise.resolve(rule);
      }
      case 'PATCH': {
        rules = rules.map((rule) => (rule.id === id ? changed(rule, body) : rule));
        return Promise.resolve(rules.find((rule) => rule.id === id));
      }
      case 'DELETE':
        rules = rules.filter((rule) => rule.id !== id);
        return Promise.resolve(null);
      default:
        return Promise.resolve({ items: rules });
    }
  });
}

/** The changes the page sent (no GETs), e.g. [{ method: 'PATCH', path: '/api/alert-rules/rule-1', body }]. */
function changes() {
  return vi
    .mocked(orvalFetch)
    .mock.calls.filter(([, init]) => init.method && init.method !== 'GET')
    .map(([url, init]) => ({
      method: init.method,
      path: url,
      body: init.body ? (JSON.parse(init.body as string) as unknown) : undefined,
    }));
}

async function openCreateDialog() {
  await userEvent.click(await screen.findByRole('button', { name: 'New alert' }));
  return screen.findByRole('dialog', { name: 'New alert' });
}

/** MUI keeps a closing dialog in the page while it fades out; the page is usable after that. */
const dialogClosed = () =>
  waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

describe('AlertRulesPage', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue(testSession());
  });

  it('shows my rules from the server: keywords or category, and on/off', async () => {
    serve([evNews, sports]);
    renderRoute('/alerts');

    const evCard = (await screen.findByRole('heading', { name: 'EV news' })).closest('li')!;
    expect(within(evCard).getByText('All of:')).toBeInTheDocument();
    expect(within(evCard).getByText('electric car')).toBeInTheDocument();
    expect(within(evCard).getByText('Tesla')).toBeInTheDocument();
    expect(within(evCard).getByRole('switch', { name: 'Send alerts for EV news' })).toBeChecked();

    // "Sends to": the channel icon, named by its tooltip
    expect(
      within(evCard).getByRole('img', { name: 'Email (test@example.com)' }),
    ).toBeInTheDocument();

    const sportsCard = screen.getByRole('heading', { name: 'Sports news' }).closest('li')!;
    expect(within(sportsCard).getByText('Sports')).toBeInTheDocument();
    expect(within(sportsCard).getByRole('switch')).not.toBeChecked();
  });

  it('shows the empty state, whose button opens the dialog', async () => {
    serve([]);
    renderRoute('/alerts');

    expect(await screen.findByRole('heading', { name: 'No alerts yet' })).toBeInTheDocument();
    // The header button is left out: the empty state has its own
    expect(screen.queryByRole('button', { name: 'New alert' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create your first alert' }));
    expect(await screen.findByRole('dialog', { name: 'New alert' })).toBeInTheDocument();
  });

  it('shows an error with "Try again" when the list does not load', async () => {
    serve([evNews], ({ method, path }) =>
      method === 'GET' && path === '/api/alert-rules'
        ? { code: 'INTERNAL_SERVER_ERROR', message: 'Boom' }
        : undefined,
    );
    renderRoute('/alerts');

    expect(await screen.findByText('Your alerts could not be loaded.')).toBeInTheDocument();
    serve([evNews]);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'EV news' })).toBeInTheDocument();
  });

  it('shows the load error when the channels do not load', async () => {
    serve([evNews], ({ method, path }) =>
      method === 'GET' && path === '/api/channels'
        ? { code: 'INTERNAL_SERVER_ERROR', message: 'Boom' }
        : undefined,
    );
    renderRoute('/alerts');

    expect(await screen.findByText('Your alerts could not be loaded.')).toBeInTheDocument();
    // No "New alert" without channels: the dialog needs them
    expect(screen.queryByRole('button', { name: 'New alert' })).not.toBeInTheDocument();
    serve([evNews]);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'EV news' })).toBeInTheDocument();
  });

  it('creates a keyword rule: Enter adds a keyword, leaving the field adds the typed text', async () => {
    const user = userEvent.setup();
    serve([sports]);
    renderRoute('/alerts');

    const dialog = await openCreateDialog();
    await user.type(within(dialog).getByRole('textbox', { name: /name/i }), 'Floods');
    const keywords = within(dialog).getByRole('combobox', { name: /keywords/i });
    await user.type(keywords, 'heavy rain{Enter}');
    await user.type(keywords, 'Danube');
    await user.click(within(dialog).getByRole('button', { name: 'Create alert' }));

    expect(await screen.findByText('Alert Floods created.')).toBeInTheDocument();
    expect(changes()).toEqual([
      {
        method: 'POST',
        path: '/api/alert-rules',
        body: {
          name: 'Floods',
          type: 'keywords',
          keywords: ['heavy rain', 'Danube'],
          // New alerts start with every channel ticked
          channelIds: ['channel-1'],
        },
      },
    ]);
    // The list was reloaded
    expect(await screen.findByRole('heading', { name: 'Floods' })).toBeInTheDocument();
  });

  it('creates a category rule with a category loaded from the server', async () => {
    const user = userEvent.setup();
    serve([evNews]);
    renderRoute('/alerts');

    const dialog = await openCreateDialog();
    await user.type(within(dialog).getByRole('textbox', { name: /name/i }), 'Health');
    await user.click(within(dialog).getByRole('radio', { name: 'Category' }));
    await user.click(within(dialog).getByRole('combobox', { name: /category/i }));
    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'World',
      'Politics',
      'Business',
      'Technology',
      'Science',
      'Health',
      'Sports',
      'Environment',
      'Other',
    ]);
    await user.click(screen.getByRole('option', { name: 'Health' }));
    await user.click(within(dialog).getByRole('button', { name: 'Create alert' }));

    expect(await screen.findByText('Alert Health created.')).toBeInTheDocument();
    expect(changes()).toEqual([
      {
        method: 'POST',
        path: '/api/alert-rules',
        body: { name: 'Health', type: 'category', category: 'health', channelIds: ['channel-1'] },
      },
    ]);
  });

  it('shows the form errors and sends nothing', async () => {
    const user = userEvent.setup();
    serve([evNews]);
    renderRoute('/alerts');

    const dialog = await openCreateDialog();
    await user.click(within(dialog).getByRole('button', { name: 'Create alert' }));

    expect(await within(dialog).findByText('Enter a name for this alert.')).toBeInTheDocument();
    expect(within(dialog).getByText('Add at least one keyword.')).toBeInTheDocument();
    // Focus moves to the first invalid field
    expect(within(dialog).getByRole('textbox', { name: /name/i })).toHaveFocus();

    await user.click(within(dialog).getByRole('radio', { name: 'Category' }));
    await user.click(within(dialog).getByRole('button', { name: 'Create alert' }));
    expect(await within(dialog).findByText('Choose a category.')).toBeInTheDocument();
    expect(changes()).toEqual([]);
  });

  it('needs at least one channel: ticked for a new alert, an error when unticked', async () => {
    const user = userEvent.setup();
    serve([evNews]);
    renderRoute('/alerts');

    const dialog = await openCreateDialog();
    const sendTo = within(dialog).getByRole('group', { name: /send to/i });
    const email = within(sendTo).getByRole('checkbox', { name: 'Email (test@example.com)' });
    expect(email).toBeChecked();

    await user.type(within(dialog).getByRole('textbox', { name: /name/i }), 'Floods');
    await user.type(within(dialog).getByRole('combobox', { name: /keywords/i }), 'flood{Enter}');
    await user.click(email);
    await user.click(within(dialog).getByRole('button', { name: 'Create alert' }));

    expect(await within(sendTo).findByText('Choose at least one channel.')).toBeInTheDocument();
    expect(email).toHaveFocus();
    expect(changes()).toEqual([]);
  });

  it('says when a keyword is already in the list (ignoring case) instead of ignoring it', async () => {
    const user = userEvent.setup();
    serve([evNews]);
    renderRoute('/alerts');

    await user.click(await screen.findByRole('button', { name: 'Edit EV news' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit alert' });
    const keywords = within(dialog).getByRole('combobox', { name: /keywords/i });

    // Enter: the message, and the text stays so it can be corrected
    await user.type(keywords, 'tesla{Enter}');
    expect(within(dialog).getByText('“tesla” is already in the list.')).toBeInTheDocument();
    expect(keywords).toHaveValue('tesla');
    // Typing again hides the message
    await user.type(keywords, 's');
    expect(within(dialog).queryByText(/already in the list/)).not.toBeInTheDocument();

    // Leaving the field: the message, and the duplicate is not added
    await user.clear(keywords);
    await user.type(keywords, 'Electric Car');
    await user.click(within(dialog).getByRole('textbox', { name: /name/i }));
    expect(within(dialog).getByText('“Electric Car” is already in the list.')).toBeInTheDocument();
    expect(keywords).toHaveValue('');
    expect(within(dialog).getAllByRole('button', { name: /electric car|tesla/i })).toHaveLength(2);
  });

  it('explains the keywords input in a tooltip', async () => {
    const user = userEvent.setup();
    serve([evNews]);
    renderRoute('/alerts');

    const dialog = await openCreateDialog();
    await user.hover(within(dialog).getByRole('button', { name: 'How to add keywords' }));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(/press Enter to add it/);
  });

  it('shows a server error in the dialog and keeps it open', async () => {
    const user = userEvent.setup();
    serve([evNews], ({ method }) =>
      method === 'POST'
        ? { code: 'ALERT_RULE_LIMIT_REACHED', message: 'You can have at most 20 alerts.' }
        : undefined,
    );
    renderRoute('/alerts');

    const dialog = await openCreateDialog();
    await user.type(within(dialog).getByRole('textbox', { name: /name/i }), 'One more');
    await user.type(within(dialog).getByRole('combobox', { name: /keywords/i }), 'storm{Enter}');
    await user.click(within(dialog).getByRole('button', { name: 'Create alert' }));

    expect(await within(dialog).findByText('You can have at most 20 alerts.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'New alert' })).toBeInTheDocument();
  });

  it('edits a rule: starts with its values, switching the type sends only the new field', async () => {
    const user = userEvent.setup();
    serve([evNews]);
    renderRoute('/alerts');

    await user.click(await screen.findByRole('button', { name: 'Edit EV news' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit alert' });
    expect(within(dialog).getByRole('textbox', { name: /name/i })).toHaveValue('EV news');
    expect(within(dialog).getByRole('button', { name: 'Tesla' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('radio', { name: 'Category' }));
    await user.click(within(dialog).getByRole('combobox', { name: /category/i }));
    await user.click(await screen.findByRole('option', { name: 'Technology' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Alert EV news saved.')).toBeInTheDocument();
    expect(changes()).toEqual([
      {
        method: 'PATCH',
        path: '/api/alert-rules/rule-1',
        body: {
          name: 'EV news',
          type: 'category',
          category: 'technology',
          channelIds: ['channel-1'],
        },
      },
    ]);
    await dialogClosed();
    const card = screen.getByRole('heading', { name: 'EV news' }).closest('li')!;
    expect(within(card).getByText('Technology')).toBeInTheDocument();
  });

  it('turns a rule off and on with the switch', async () => {
    const user = userEvent.setup();
    serve([evNews]);
    renderRoute('/alerts');

    const toggle = await screen.findByRole('switch', { name: 'Send alerts for EV news' });
    await user.click(toggle);

    expect(await screen.findByText('Alert EV news turned off.')).toBeInTheDocument();
    expect(toggle).not.toBeChecked();
    expect(changes()).toEqual([
      { method: 'PATCH', path: '/api/alert-rules/rule-1', body: { enabled: false } },
    ]);

    await user.click(toggle);
    expect(await screen.findByText('Alert EV news turned on.')).toBeInTheDocument();
    expect(toggle).toBeChecked();
  });

  it('deletes a rule after asking', async () => {
    const user = userEvent.setup();
    serve([evNews, sports]);
    renderRoute('/alerts');

    await user.click(await screen.findByRole('button', { name: 'Delete EV news' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete EV news?' });
    // Cancel has the focus, so Enter doesn't delete by accident
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Alert EV news deleted.')).toBeInTheDocument();
    expect(changes()).toEqual([
      { method: 'DELETE', path: '/api/alert-rules/rule-1', body: undefined },
    ]);
    await dialogClosed();
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'EV news' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('heading', { name: 'Sports news' })).toBeInTheDocument();
  });

  it(`disables "New alert" at ${ALERT_RULES_PER_USER_MAX} rules`, async () => {
    serve(
      Array.from({ length: ALERT_RULES_PER_USER_MAX }, (_, i) =>
        testAlertRule({ id: `rule-${i}`, name: `Rule ${i}` }),
      ),
    );
    renderRoute('/alerts');

    expect(await screen.findByRole('button', { name: 'New alert' })).toBeDisabled();
    expect(screen.getByText(/which is the maximum/)).toBeInTheDocument();
  });
});
