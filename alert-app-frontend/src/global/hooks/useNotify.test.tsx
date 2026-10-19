import { Button } from '@mui/material';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import { useNotify } from './useNotify';

function SaveButton() {
  const notify = useNotify();
  return <Button onClick={() => notify('Saved')}>Save</Button>;
}

describe('useNotify', () => {
  it('shows the message and closes it with the close button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SaveButton />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Saved');

    await user.click(screen.getByRole('button', { name: 'Close' }));

    // The snackbar fades out before it is removed
    await expect.poll(() => screen.queryByRole('alert'), { timeout: 2000 }).not.toBeInTheDocument();
  });
});
