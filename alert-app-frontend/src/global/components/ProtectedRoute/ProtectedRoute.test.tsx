import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { adminSession, testSession } from '../../../test/fixtures';
import { renderRoute } from '../../../test/renderWithProviders';
import { getSession } from '../../utils/authApi';

// Tested through the real routes: /admin uses <ProtectedRoute requireAdmin />.
// authApi is mocked for all tests (see src/test/setup.ts).

describe('ProtectedRoute', () => {
  it('shows a spinner while the session loads', async () => {
    vi.mocked(getSession).mockReturnValue(new Promise(() => {}));
    renderRoute('/admin');

    expect(await screen.findByRole('progressbar', { name: 'Loading…' })).toBeInTheDocument();
  });

  it('sends logged-out users to the login page, with the way back', async () => {
    const { router } = renderRoute('/admin');

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('?redirectTo=%2Fadmin');
  });

  it('sends users who are not admins to Home', async () => {
    vi.mocked(getSession).mockResolvedValue(testSession());
    const { router } = renderRoute('/admin');

    expect(
      await screen.findByRole('heading', { name: 'Get notified when something important happens' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('shows the page to admins', async () => {
    vi.mocked(getSession).mockResolvedValue(adminSession());
    renderRoute('/admin');

    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument();
  });
});
