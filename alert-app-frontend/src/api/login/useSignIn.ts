import { useMutation, useQueryClient } from '@tanstack/react-query';
import { signIn } from '../../global/utils/authApi';
import { sessionQueryKey } from '../auth/useSession';

/** Logs in with email and password. Throws an ApiRequestError when the server rejects it. */
export function useSignIn() {
  const queryClient = useQueryClient();

  return useMutation({
    // Not `mutationFn: signIn`: TanStack Query passes a second argument we don't want to send
    mutationFn: (values: Parameters<typeof signIn>[0]) => signIn(values),
    // Reload the session, so every useSession() sees the logged-in user
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionQueryKey }),
  });
}
