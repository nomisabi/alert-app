import { useQueryClient } from '@tanstack/react-query';
import { isUsernameAvailable } from '../../global/utils/authApi';

/**
 * Returns a function that asks the server whether a username is still free.
 * A function (not useQuery), because the form calls it when the field loses focus, not on render.
 *
 * @example
 * const checkUsername = useCheckUsername();
 * const { available } = await checkUsername('noemi.sz');
 */
export function useCheckUsername() {
  const queryClient = useQueryClient();

  return (username: string) =>
    queryClient.fetchQuery({
      queryKey: ['username-available', username],
      queryFn: () => isUsernameAvailable(username),
    });
}
