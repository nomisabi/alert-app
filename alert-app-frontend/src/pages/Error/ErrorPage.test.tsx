import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RouteObject } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppLayout } from '../../global/components/AppLayout/AppLayout';
import { renderRoute } from '../../test/renderWithProviders';
import { ErrorPage } from './ErrorPage';

function BrokenPage(): never {
  throw new Error('Test crash');
}

// Same shape as the real routes in app/routes.tsx, plus a page that crashes
const testRoutes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <ErrorPage withoutLayout />,
    children: [
      {
        errorElement: <ErrorPage />,
        children: [
          { index: true, element: <h1>Home</h1> },
          { path: 'broken', element: <BrokenPage /> },
        ],
      },
    ],
  },
];

describe('ErrorPage', () => {
  beforeEach(() => {
    // React and React Router log caught render errors; keep the test output clean
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the error inside the layout when a page crashes', () => {
    renderRoute('/broken', testRoutes);

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByText('Alert App')).toBeInTheDocument();
    expect(screen.getByText(/Test crash/)).toBeInTheDocument();
  });

  it('links back to the home page', async () => {
    const user = userEvent.setup();
    renderRoute('/broken', testRoutes);

    await user.click(screen.getByRole('link', { name: 'Back to home' }));

    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
  });
});
