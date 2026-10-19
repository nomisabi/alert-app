import { useQuery } from '@tanstack/react-query';
import { getSession } from '../../global/utils/authApi';

export const sessionQueryKey = ['session'] as const;

/**
 * The logged-in user (or null), loaded once and cached by TanStack Query.
 * After login/logout, invalidate `sessionQueryKey` to load it again.
 *
 * @example
 * const { user, isPending } = useSession();
 */
export function useSession() {
  const query = useQuery({
    queryKey: sessionQueryKey,
    queryFn: getSession,
    // The session changes only on login/logout, and we refresh it ourselves then
    staleTime: 5 * 60_000,
  });

  return { user: query.data?.user ?? null, isPending: query.isPending };
}
