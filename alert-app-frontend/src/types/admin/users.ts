import type { AdminUser, UpdateAdminUserRequest } from '@alert-app/shared';
import type { TFunction } from 'i18next';

/** What the admin users page asks the server for. */
export interface AdminUsersParams {
  search: string;
  /** 1-based. */
  page: number;
  pageSize: number;
}

/** Input of useUpdateAdminUser: the whole user (for messages like "Anna is now an admin") and the changes. */
export interface UpdateAdminUserVariables {
  user: AdminUser;
  changes: UpdateAdminUserRequest;
}

export interface UserActionsMenuProps {
  user: AdminUser;
  /** True while a change for this user is being saved. */
  disabled?: boolean;
  onToggleRole: () => void;
  onDisable: () => void;
  onEnable: () => void;
}

/** Everything the users table columns need from the page. */
export interface UserColumnsOptions {
  t: TFunction<'admin'>;
  /** The logged-in admin: their own row gets a "You" chip and no actions. */
  currentUserId: string | undefined;
  /** The user whose change is being saved (their actions button is disabled). */
  pendingUserId: string | undefined;
  onToggleRole: (user: AdminUser) => void;
  onDisable: (user: AdminUser) => void;
  onEnable: (user: AdminUser) => void;
}
