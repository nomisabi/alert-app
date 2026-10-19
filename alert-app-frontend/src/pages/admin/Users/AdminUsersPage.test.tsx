import type { AdminUser, AdminUserList } from '@alert-app/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, orvalFetch } from '../../../global/utils/apiFetch';
import { getSession } from '../../../global/utils/authApi';
import { adminSession, testAdminUser, testAdminUserList } from '../../../test/fixtures';
import { renderRoute } from '../../../test/renderWithProviders';

// The generated Orval code sends every request through orvalFetch. Faking it (and nothing else)
// tests the real generated hooks, our hooks in api/admin/ and the query cache.
vi.mock('../../../global/utils/apiFetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../global/utils/apiFetch')>()),
  orvalFetch: vi.fn(),
}));

const me = testAdminUser({
  id: 'admin-1',
  name: 'Admin',
  role: 'admin',
  email: 'admin@example.com',
});
const bob = testAdminUser({ id: 'user-2', name: 'Bob Builder' });
const carol = testAdminUser({
  id: 'user-3',
  name: 'Carol Disabled',
  username: 'Carol.D',
  disabled: true,
});

/**
 * Answers the page's requests: GET returns `list` (or a function of the query), PATCH the updated user.
 * Returns the requests the page sent, as { method, path, query, body }.
 */
function serve(list: AdminUserList | ((query: URLSearchParams) => AdminUserList)) {
  vi.mocked(orvalFetch).mockImplementation((url: string, init: RequestInit) => {
    const { pathname, searchParams } = new URL(url, 'http://localhost');
    if (init.method === 'PATCH') {
      const id = pathname.split('/').at(-1);
      const user = [me, bob, carol].find((candidate) => candidate.id === id)!;
      return Promise.resolve({
        ...user,
        ...(JSON.parse(init.body as string) as Partial<AdminUser>),
      });
    }
    return Promise.resolve(typeof list === 'function' ? list(searchParams) : list);
  });
}

/** The requests the page sent, e.g. [{ method: 'GET', path: '/api/admin/users', query: {...} }]. */
function requests() {
  return vi.mocked(orvalFetch).mock.calls.map(([url, init]) => {
    const { pathname, searchParams } = new URL(url, 'http://localhost');
    return {
      method: init.method,
      path: pathname,
      query: Object.fromEntries(searchParams),
      body: init.body ? (JSON.parse(init.body as string) as unknown) : undefined,
    };
  });
}

async function openActions(name: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Actions for ${name}` }));
}

describe('AdminUsersPage', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue(adminSession());
  });

  it('shows the first page of users from the server', async () => {
    serve(testAdminUserList([me, bob, carol]));
    renderRoute('/admin/users');

    expect(await screen.findByRole('heading', { name: 'Bob Builder' })).toBeInTheDocument();
    expect(requests()).toEqual([
      {
        method: 'GET',
        path: '/api/admin/users',
        query: { page: '1', pageSize: '20' },
        body: undefined,
      },
    ]);

    const carolCard = screen.getByRole('heading', { name: 'Carol Disabled' }).closest('li')!;
    expect(within(carolCard).getByText('Disabled')).toBeInTheDocument();
    expect(within(carolCard).getByText('@Carol.D')).toBeInTheDocument();
    expect(within(carolCard).getByText('Oct 19, 2026')).toBeInTheDocument();
    expect(screen.getByText('1–3 of 3')).toBeInTheDocument();
  });

  it('marks your own row and has no actions for it', async () => {
    serve(testAdminUserList([me, bob]));
    renderRoute('/admin/users');

    const myCard = (await screen.findByRole('heading', { name: /Admin/ })).closest('li')!;
    expect(within(myCard).getByText('You')).toBeInTheDocument();
    expect(within(myCard).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actions for Bob Builder' })).toBeInTheDocument();
  });

  it('loads the next page, and searches from page 1 after typing stops', async () => {
    const user = userEvent.setup();
    serve((query) =>
      query.get('search') === 'zzz'
        ? testAdminUserList([])
        : testAdminUserList([bob], { total: 45, page: Number(query.get('page')) }),
    );
    renderRoute('/admin/users');

    await user.click(await screen.findByRole('button', { name: 'Go to next page' }));
    expect(await screen.findByText('21–40 of 45')).toBeInTheDocument();
    expect(requests().at(-1)?.query).toEqual({ page: '2', pageSize: '20' });

    await user.type(screen.getByRole('searchbox', { name: 'Search users' }), 'zzz');

    expect(await screen.findByText('No users match “zzz”.')).toBeInTheDocument();
    // One request for the whole word (debounced), not one per letter
    expect(requests().filter((request) => request.query.search)).toEqual([
      expect.objectContaining({ query: { search: 'zzz', page: '1', pageSize: '20' } }),
    ]);
  });

  it('makes a user admin, then reloads the list and says so', async () => {
    serve(testAdminUserList([me, bob]));
    renderRoute('/admin/users');

    await openActions('Bob Builder');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Make admin' }));

    expect(await screen.findByText('Bob Builder is now an admin.')).toBeInTheDocument();
    expect(requests()).toEqual([
      expect.objectContaining({ method: 'GET' }),
      { method: 'PATCH', path: '/api/admin/users/user-2', query: {}, body: { role: 'admin' } },
      expect.objectContaining({ method: 'GET' }),
    ]);
  });

  it('asks before disabling: Cancel changes nothing, Disable does', async () => {
    const user = userEvent.setup();
    serve(testAdminUserList([me, bob]));
    renderRoute('/admin/users');

    await openActions('Bob Builder');
    await user.click(screen.getByRole('menuitem', { name: 'Disable account' }));
    const dialog = screen.getByRole('dialog', { name: 'Disable Bob Builder?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(requests().filter((request) => request.method === 'PATCH')).toEqual([]);

    await openActions('Bob Builder');
    await user.click(screen.getByRole('menuitem', { name: 'Disable account' }));
    await user.click(screen.getByRole('button', { name: 'Disable' }));

    expect(await screen.findByText("Bob Builder's account is disabled.")).toBeInTheDocument();
    expect(requests().filter((request) => request.method === 'PATCH')).toEqual([
      expect.objectContaining({ path: '/api/admin/users/user-2', body: { disabled: true } }),
    ]);
  });

  it('enables a disabled user without asking', async () => {
    serve(testAdminUserList([me, carol]));
    renderRoute('/admin/users');

    await openActions('Carol Disabled');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Enable account' }));

    expect(
      await screen.findByText("Carol Disabled's account is enabled again."),
    ).toBeInTheDocument();
    expect(requests().at(1)).toMatchObject({ method: 'PATCH', body: { disabled: false } });
  });

  it("shows the server's message when a change fails", async () => {
    serve(testAdminUserList([me, bob]));
    vi.mocked(orvalFetch).mockImplementation((_url, init) =>
      init.method === 'PATCH'
        ? Promise.reject(
            new ApiRequestError(404, {
              code: 'USER_NOT_FOUND',
              message: 'This user does not exist.',
            }),
          )
        : Promise.resolve(testAdminUserList([me, bob])),
    );
    renderRoute('/admin/users');

    await openActions('Bob Builder');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Make admin' }));

    expect(await screen.findByText('This user does not exist.')).toBeInTheDocument();
  });

  it('shows an error with "Try again" when the list can not be loaded', async () => {
    const user = userEvent.setup();
    vi.mocked(orvalFetch).mockRejectedValueOnce(
      new ApiRequestError(0, { code: 'NETWORK_ERROR', message: 'offline' }),
    );
    renderRoute('/admin/users');

    expect(await screen.findByRole('alert')).toHaveTextContent('The users could not be loaded.');

    serve(testAdminUserList([me, bob]));
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Bob Builder' })).toBeInTheDocument();
  });
});
