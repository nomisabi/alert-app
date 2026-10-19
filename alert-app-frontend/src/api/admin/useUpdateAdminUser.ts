import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UpdateAdminUserVariables } from '../../types/admin/users';
import { getGetAdminUsersQueryKey, updateAdminUser } from '../generated/admin/admin';

/** Changes a user's role or disabled state (PATCH /api/admin/users/:id), then reloads the users list. */
export function useUpdateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    // Not the generated useUpdateAdminUser: our variables carry the whole user, for messages like "Anna is now an admin"
    mutationFn: ({ user, changes }: UpdateAdminUserVariables) => updateAdminUser(user.id, changes),
    // The key without params is the start of every page's key, so this reloads all loaded pages
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() }),
  });
}
