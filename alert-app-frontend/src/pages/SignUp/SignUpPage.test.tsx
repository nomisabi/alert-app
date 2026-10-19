import { screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../../global/utils/apiFetch';
import { getSession, isUsernameAvailable, signUp } from '../../global/utils/authApi';
import { testSession } from '../../test/fixtures';
import { renderRoute } from '../../test/renderWithProviders';

// authApi is mocked for all tests (see src/test/setup.ts): logged out, every username free

const fields = {
  name: () => screen.getByRole('textbox', { name: /display name/i }),
  username: () => screen.getByRole('textbox', { name: /username/i }),
  email: () => screen.getByRole('textbox', { name: /email/i }),
  password: () => screen.getByLabelText(/^password/i),
  confirmPassword: () => screen.getByLabelText(/^repeat password/i),
};
const submitButton = () => screen.getByRole('button', { name: 'Sign up' });

async function fillValidForm(user: UserEvent) {
  await user.type(fields.name(), 'Noemi');
  await user.type(fields.username(), 'Noemi.Sz');
  await user.type(fields.email(), 'Noemi@Example.com');
  await user.type(fields.password(), 'secret123');
  await user.type(fields.confirmPassword(), 'secret123');
}

function setup() {
  const user = userEvent.setup();
  renderRoute('/signup');
  return user;
}

describe('SignUpPage', () => {
  describe('validation in the browser', () => {
    it('shows an error when leaving an empty field', async () => {
      const user = setup();

      await user.click(fields.name());
      await user.tab();

      expect(await screen.findByText('Enter a display name.')).toBeInTheDocument();
    });

    it('moves focus to the first wrong field on submit', async () => {
      const user = setup();

      await user.click(submitButton());

      await waitFor(() => expect(fields.name()).toHaveFocus());
      expect(screen.getByText('Enter a username.')).toBeInTheDocument();
      expect(signUp).not.toHaveBeenCalled();
    });

    it('shows rule errors and removes them once fixed', async () => {
      const user = setup();

      await user.type(fields.username(), 'abcde');
      await user.tab();
      expect(await screen.findByText('Use at least 6 characters.')).toBeInTheDocument();
      await user.type(fields.username(), 'f');
      await waitFor(() =>
        expect(screen.queryByText('Use at least 6 characters.')).not.toBeInTheDocument(),
      );

      await user.type(fields.password(), 'password');
      await user.tab();
      expect(await screen.findByText('Add at least one number.')).toBeInTheDocument();

      await user.type(fields.confirmPassword(), 'something1');
      await user.tab();
      expect(await screen.findByText("The passwords don't match.")).toBeInTheDocument();
    });
  });

  describe('sending the form', () => {
    it('sends the sign-up without "repeat password" and goes to Home', async () => {
      vi.mocked(signUp).mockImplementation(async () => {
        // Sign-up logs in: from now on the session has a user
        vi.mocked(getSession).mockResolvedValue(testSession({ name: 'Noemi' }));
        return testSession({ name: 'Noemi' });
      });
      const user = setup();

      await fillValidForm(user);
      await user.click(submitButton());

      expect(signUp).toHaveBeenCalledWith({
        name: 'Noemi',
        username: 'Noemi.Sz',
        email: 'noemi@example.com',
        password: 'secret123',
      });
      expect(
        await screen.findByRole('heading', {
          name: 'Get notified when something important happens',
        }),
      ).toBeInTheDocument();
    });

    it("shows the server's field errors under the right fields", async () => {
      vi.mocked(signUp).mockRejectedValue(
        new ApiRequestError(400, {
          code: 'VALIDATION_FAILED',
          message: 'Please check the highlighted fields.',
          fieldErrors: [
            { field: 'username', message: 'Server: username problem.' },
            { field: 'email', message: 'Server: email problem.' },
          ],
        }),
      );
      const user = setup();

      await fillValidForm(user);
      await user.click(submitButton());

      expect(await screen.findByText('Server: username problem.')).toBeInTheDocument();
      expect(screen.getByText('Server: email problem.')).toBeInTheDocument();
      expect(fields.username()).toHaveFocus();
    });

    it('shows a server error without a field above the button', async () => {
      vi.mocked(signUp).mockRejectedValue(
        new ApiRequestError(500, { code: 'INTERNAL_SERVER_ERROR', message: 'Server: broken.' }),
      );
      const user = setup();

      await fillValidForm(user);
      await user.click(submitButton());

      expect(await screen.findByRole('alert')).toHaveTextContent('Server: broken.');
    });
  });

  describe('username check when leaving the field', () => {
    it('shows an error when the username is taken', async () => {
      vi.mocked(isUsernameAvailable).mockResolvedValue({ available: false });
      const user = setup();

      await user.type(fields.username(), 'Admin.User');
      await user.tab();

      expect(await screen.findByText('This username is already taken.')).toBeInTheDocument();
      expect(isUsernameAvailable).toHaveBeenCalledWith('Admin.User');
    });

    it('shows nothing when the username is free', async () => {
      const user = setup();

      await user.type(fields.username(), 'free.name');
      await user.tab();

      await waitFor(() => expect(isUsernameAvailable).toHaveBeenCalled());
      expect(screen.queryByText('This username is already taken.')).not.toBeInTheDocument();
    });

    it('shows a warning when the check fails', async () => {
      vi.mocked(isUsernameAvailable).mockRejectedValue(new Error('offline'));
      const user = setup();

      await user.type(fields.username(), 'free.name');
      await user.tab();

      expect(
        await screen.findByText(
          "We couldn't check if this username is free. We'll check it again when you sign up.",
        ),
      ).toBeInTheDocument();
    });

    it('does not ask the server when the username breaks the rules', async () => {
      const user = setup();

      await user.type(fields.username(), 'abc');
      await user.tab();

      expect(await screen.findByText('Use at least 6 characters.')).toBeInTheDocument();
      expect(isUsernameAvailable).not.toHaveBeenCalled();
    });
  });

  it('sends logged-in users to Home', async () => {
    vi.mocked(getSession).mockResolvedValue(testSession());
    renderRoute('/signup');

    expect(
      await screen.findByRole('heading', { name: 'Get notified when something important happens' }),
    ).toBeInTheDocument();
  });
});
