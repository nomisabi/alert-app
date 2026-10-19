import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { useForm, type ErrorOption } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { FormTextField } from './FormTextField';

/** A one-field form; `error` is set on the field right away. */
function TestForm({ error }: { error?: ErrorOption }) {
  const { control, setError } = useForm({ defaultValues: { password: '' } });

  useEffect(() => {
    if (error) setError('password', error);
  }, [error, setError]);

  return (
    <FormTextField
      control={control}
      name="password"
      type="password"
      label="Password"
      helperText="Hint text"
    />
  );
}

describe('FormTextField', () => {
  it('shows the helper text when there is no error', () => {
    renderWithProviders(<TestForm />);

    expect(screen.getByText('Hint text')).toBeInTheDocument();
  });

  it('translates Zod error keys, including their values', async () => {
    renderWithProviders(<TestForm error={{ type: 'too_small', message: 'password.tooShort' }} />);

    expect(await screen.findByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(screen.queryByText('Hint text')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows server errors as they are (already translated)', async () => {
    renderWithProviders(<TestForm error={{ type: 'server', message: 'Text from the server.' }} />);

    expect(await screen.findByText('Text from the server.')).toBeInTheDocument();
  });

  it('shows and hides the password', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TestForm />);
    const input = screen.getByLabelText('Password');

    expect(input).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });
});
