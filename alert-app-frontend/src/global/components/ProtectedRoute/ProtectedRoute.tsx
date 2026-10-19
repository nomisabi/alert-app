import { Navigate, Outlet, useLocation } from 'react-router';
import { useSession } from '../../../api/auth/useSession';
import { Loading } from '../Loading/Loading';

interface ProtectedRouteProps {
  /** Only admins may see the pages below. Other users are sent to Home. */
  requireAdmin?: boolean;
}

/**
 * Layout route for pages that need a logged-in user. Logged-out users go to the login page,
 * which sends them back here afterwards (`?redirectTo=`).
 * The backend checks the same again (AuthGuard/AdminGuard); this only decides what to show.
 */
export function ProtectedRoute({ requireAdmin = false }: ProtectedRouteProps) {
  const { user, isPending } = useSession();
  const location = useLocation();

  if (isPending) return <Loading fullPage />;

  if (!user) {
    const redirectTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirectTo=${redirectTo}`} replace />;
  }

  if (requireAdmin && user.role !== 'admin') return <Navigate to="/" replace />;

  return <Outlet />;
}
