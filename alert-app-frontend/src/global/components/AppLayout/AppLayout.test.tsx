import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { adminSession, testSession } from '../../../test/fixtures';
import { renderRoute } from '../../../test/renderWithProviders';
import { getSession, signIn, signOut, type Session } from '../../utils/authApi';

// authApi is mocked for all tests (see src/test/setup.ts)

describe('AppLayout', () => {
  it('shows "Log in" and "Sign up" when logged out', async () => {
    renderRoute('/');

    expect(await screen.findByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/signup');
  });

  it("shows the user's name and a menu without the admin link for users", async () => {
    const user = userEvent.setup();
    vi.mocked(getSession).mockResolvedValue(testSession());
    renderRoute('/');

    await user.click(await screen.findByRole('button', { name: 'Account menu for Test User' }));

    expect(screen.getByText('@Test.User')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Log out' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Admin' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument();
  });

  it('shows the admin link for admins', async () => {
    const user = userEvent.setup();
    vi.mocked(getSession).mockResolvedValue(adminSession());
    renderRoute('/');

    await user.click(await screen.findByRole('button', { name: 'Account menu for Admin' }));

    expect(screen.getByRole('menuitem', { name: 'Admin' })).toHaveAttribute('href', '/admin');
  });

  // Bug found in milestone 1: after logging out and in as someone else, the AppBar kept the old name
  it('shows the new user after logging out and in as someone else, without a reload', async () => {
    const user = userEvent.setup();
    let session: Session | null = adminSession();
    vi.mocked(getSession).mockImplementation(async () => session);
    vi.mocked(signOut).mockImplementation(async () => {
      session = null;
      return { success: true };
    });
    vi.mocked(signIn).mockImplementation(async () => {
      session = testSession({ name: 'User One' });
      return session;
    });
    renderRoute('/');

    // Log out as admin
    await user.click(await screen.findByRole('button', { name: 'Account menu for Admin' }));
    await user.click(screen.getByRole('menuitem', { name: 'Log out' }));

    expect(await screen.findByRole('link', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /account menu/i })).not.toBeInTheDocument();
    expect(await screen.findByText("You've been logged out.")).toBeInTheDocument();

    // Log in as another user. Logout went to the login page; findBy waits until it's rendered
    await user.type(await screen.findByRole('textbox', { name: /email/i }), 'user1@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(
      await screen.findByRole('button', { name: 'Account menu for User One' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Account menu for Admin' }),
    ).not.toBeInTheDocument();
  });
});
