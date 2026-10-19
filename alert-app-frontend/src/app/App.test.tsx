import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderRoute } from '../test/renderWithProviders';

describe('App routes', () => {
  it('renders the layout and home page', () => {
    renderRoute('/');

    expect(screen.getByText('Alert App')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Welcome to Alert App' })).toBeInTheDocument();
  });

  it('shows the 404 page for unknown routes and links back home', async () => {
    const user = userEvent.setup();
    renderRoute('/does-not-exist');

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Back to home' }));

    expect(screen.getByRole('heading', { name: 'Welcome to Alert App' })).toBeInTheDocument();
  });
});
