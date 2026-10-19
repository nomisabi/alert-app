import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderRoute } from '../test/renderWithProviders';

const homeTitle = 'Get notified when something important happens';

describe('App routes', () => {
  it('renders the layout and home page', () => {
    renderRoute('/');

    expect(screen.getByText('Alert App')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: homeTitle })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
  });

  it('has a skip link to the main content', () => {
    renderRoute('/');

    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main-content',
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('shows the 404 page for unknown routes and links back home', async () => {
    const user = userEvent.setup();
    renderRoute('/does-not-exist');

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Back to home' }));

    expect(screen.getByRole('heading', { level: 1, name: homeTitle })).toBeInTheDocument();
  });
});
