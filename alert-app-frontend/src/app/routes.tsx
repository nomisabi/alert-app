import type { RouteObject } from 'react-router';
import { AppLayout } from '../components/AppLayout/AppLayout';
import { HomePage } from '../pages/HomePage/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage/NotFoundPage';

// Kept separate from the router instance so tests can render the same routes in a memory router.
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
