import { Button } from '@mui/material';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('shows a heading, the description and the action', async () => {
    const onCreate = vi.fn();
    renderWithProviders(
      <EmptyState
        icon={<span>icon</span>}
        title="No fruits yet"
        description="Add your first fruit."
        action={<Button onClick={onCreate}>Add fruit</Button>}
      />,
    );

    expect(screen.getByRole('heading', { name: 'No fruits yet' })).toBeInTheDocument();
    expect(screen.getByText('Add your first fruit.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add fruit' }));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it('hides the icon from screen readers', () => {
    renderWithProviders(<EmptyState icon={<span>icon</span>} title="Empty" />);

    expect(screen.getByText('icon').parentElement).toHaveAttribute('aria-hidden', 'true');
  });
});
