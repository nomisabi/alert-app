import type { RouteObject } from 'react-router';
import { AppLayout } from '../global/components/AppLayout/AppLayout';
import { ProtectedRoute } from '../global/components/ProtectedRoute/ProtectedRoute';
import { AdminHomePage } from '../pages/admin/Home/AdminHomePage';
import { ErrorPage } from '../pages/Error/ErrorPage';
import { HomePage } from '../pages/Home/HomePage';
import { LoginPage } from '../pages/Login/LoginPage';
import { NotFoundPage } from '../pages/NotFound/NotFoundPage';
import { SignUpPage } from '../pages/SignUp/SignUpPage';

// Kept separate from the router instance so tests can render the same routes in a memory router.
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    // Fallback if the layout itself fails
    errorElement: <ErrorPage withoutLayout />,
    children: [
      {
        // Pathless route: catches errors from the pages below, so the AppBar stays visible
        errorElement: <ErrorPage />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'login', element: <LoginPage /> },
          { path: 'signup', element: <SignUpPage /> },
          {
            element: <ProtectedRoute requireAdmin />,
            children: [{ path: 'admin', element: <AdminHomePage /> }],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
