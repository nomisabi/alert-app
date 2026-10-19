import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../../global/utils/apiFetch';
import { getSession, signIn, type Session } from '../../global/utils/authApi';
import { adminSession, testSession } from '../../test/fixtures';
import { renderRoute } from '../../test/renderWithProviders';

// authApi is mocked for all tests (see src/test/setup.ts)

const homeHeading = { name: 'Get notified when something important happens' };

/** Login succeeds and logs in as `session` (getSession returns it afterwards). */
function loginSucceedsAs(session: Session) {
  vi.mocked(signIn).mockImplementation(async () => {
    vi.mocked(getSession).mockResolvedValue(session);
    return session;
  });
}

async function logIn(path: string) {
  const user = userEvent.setup();
  const result = renderRoute(path);

  await user.type(screen.getByRole('textbox', { name: /email/i }), 'admin@example.com');
  await user.type(screen.getByLabelText(/^password/i), 'secret123');
  await user.click(screen.getByRole('button', { name: 'Log in' }));

  return result;
}

describe('LoginPage', () => {
  it("shows the server's message above the button when the login fails", async () => {
    vi.mocked(signIn).mockRejectedValue(
      new ApiRequestError(401, {
        code: 'INVALID_EMAIL_OR_PASSWORD',
        message: 'Invalid email or password.',
      }),
    );

    await logIn('/login');

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(signIn).toHaveBeenCalledWith({ email: 'admin@example.com', password: 'secret123' });
  });

  it('goes back to the page that asked for login', async () => {
    loginSucceedsAs(adminSession());

    const { router } = await logIn('/login?redirectTo=%2Fadmin');

    expect(await screen.findByRole('heading', { name: 'Admin' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin');
  });

  it.each(['https://evil.example', '//evil.example'])(
    'goes to Home instead of an outside address (%s)',
    async (redirectTo) => {
      loginSucceedsAs(testSession());

      const { router } = await logIn(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);

      expect(await screen.findByRole('heading', homeHeading)).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/');
    },
  );

  it('sends logged-in users to Home', async () => {
    vi.mocked(getSession).mockResolvedValue(testSession());
    renderRoute('/login');

    expect(await screen.findByRole('heading', homeHeading)).toBeInTheDocument();
  });
});
