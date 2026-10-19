import { useMutation, useQueryClient } from '@tanstack/react-query';
import { signUp } from '../../global/utils/authApi';
import { sessionQueryKey } from '../auth/useSession';

/** Creates an account and logs in. Throws an ApiRequestError when the server rejects it. */
export function useSignUp() {
  const queryClient = useQueryClient();

  return useMutation({
    // Takes the form values: "repeat password" is only checked in the browser, so it isn't sent
    mutationFn: ({ name, username, email, password }: Parameters<typeof signUp>[0]) =>
      signUp({ name, username, email, password }),
    // Sign-up also logs in: reload the session
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionQueryKey }),
  });
}
