import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { ConfirmDialog } from './ConfirmDialog';

function renderDialog(props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  renderWithProviders(
    <ConfirmDialog
      open
      title="Disable Bob?"
      description="Bob will be logged out."
      confirmLabel="Disable"
      onConfirm={onConfirm}
      onClose={onClose}
      {...props}
    />,
  );
  return { onConfirm, onClose };
}

describe('ConfirmDialog', () => {
  it('is an accessible dialog with its title and description', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: 'Disable Bob?' });
    expect(dialog).toHaveAccessibleDescription('Bob will be logged out.');
  });

  it('confirms or cancels', async () => {
    const user = userEvent.setup();
    const { onConfirm, onClose } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Disable' }));
    expect(onConfirm).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('focuses Cancel for destructive actions, so Enter does not destroy anything', () => {
    renderDialog({ destructive: true });

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it("can't be closed while the action runs", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog({ isPending: true });

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });
});
