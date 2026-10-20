import { Navigate, type RouteObject } from 'react-router';
import { AppLayout } from '../global/components/AppLayout/AppLayout';
import { AlertRulesPage } from '../pages/AlertRules/AlertRulesPage';
import { ProtectedRoute } from '../global/components/ProtectedRoute/ProtectedRoute';
import { AdminUsersPage } from '../pages/admin/Users/AdminUsersPage';
import { ChannelsPage } from '../pages/Channels/ChannelsPage';
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
            element: <ProtectedRoute />,
            children: [
              { path: 'alerts', element: <AlertRulesPage /> },
              { path: 'channels', element: <ChannelsPage /> },
            ],
          },
          {
            element: <ProtectedRoute requireAdmin />,
            children: [
              {
                path: 'admin',
                children: [
                  // Users is the only admin page for now
                  { index: true, element: <Navigate to="users" replace /> },
                  { path: 'users', element: <AdminUsersPage /> },
                ],
              },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
