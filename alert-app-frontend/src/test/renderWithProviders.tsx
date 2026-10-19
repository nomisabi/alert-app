import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { AppProviders } from '../app/AppProviders';
import { createQueryClient } from '../app/queryClient';
import { routes } from '../app/routes';

/** Renders a component with the theme, a fresh query client and i18n. */
export function renderWithProviders(ui: ReactElement) {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });

  return render(<AppProviders queryClient={queryClient}>{ui}</AppProviders>);
}

/** Renders the real app routes (or the given test routes) at the given URL. */
export function renderRoute(path: string, routeList: RouteObject[] = routes) {
  const router = createMemoryRouter(routeList, { initialEntries: [path] });

  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}
