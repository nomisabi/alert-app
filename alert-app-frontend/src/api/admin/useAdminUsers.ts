import { keepPreviousData } from '@tanstack/react-query';
import type { AdminUsersParams } from '../../types/admin/users';
import { useGetAdminUsers } from '../generated/admin/admin';

/** One page of users for the admin users page (GET /api/admin/users). */
export function useAdminUsers({ search, page, pageSize }: AdminUsersParams) {
  // An empty search is left out, so the URL stays /api/admin/users?page=1&pageSize=20
  return useGetAdminUsers(
    { search: search || undefined, page, pageSize },
    // Keep showing the current page while the next one loads, so the table doesn't jump
    { query: { placeholderData: keepPreviousData } },
  );
}
