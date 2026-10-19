import { useMutation, useQueryClient } from '@tanstack/react-query';
import { signOut } from '../../global/utils/authApi';
import { sessionQueryKey } from './useSession';

/**
 * Logs out and forgets everything cached for this user.
 *
 * Use `mutateAsync` and continue after `await` (e.g. navigate): the component that started the
 * logout may unmount when the session becomes `null`, and then `mutate(..., { onSuccess })` never runs.
 */
export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => signOut(),
    onSuccess: () => {
      // Tell every component using useSession() (e.g. the AppBar) right away. queryClient.clear()
      // is not enough: it removes the data, but components already on screen keep showing it.
      queryClient.setQueryData(sessionQueryKey, null);
      // Forget everything else cached for this user
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== sessionQueryKey[0] });
    },
  });
}
