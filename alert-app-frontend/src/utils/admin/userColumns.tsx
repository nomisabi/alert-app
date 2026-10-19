import type { AdminUser } from '@alert-app/shared';
import { Chip } from '@mui/material';
import type { DataTableColumn } from '../../global/components/DataTable/DataTable';
import { formatDate } from '../../global/utils/date';
import styles from '../../pages/admin/Users/AdminUsersPage.module.scss';
import { UserActionsMenu } from '../../pages/admin/Users/UserActionsMenu';
import type { UserColumnsOptions } from '../../types/admin/users';

/**
 * Columns of the admin users table. A function, not a plain constant, because the
 * cells need the translations, the logged-in user and the page's action handlers.
 */
export function getUserColumns({
  t,
  currentUserId,
  pendingUserId,
  onToggleRole,
  onDisable,
  onEnable,
}: UserColumnsOptions): DataTableColumn<AdminUser>[] {
  return [
    {
      key: 'name',
      header: t('users.columns.name'),
      cardPlacement: 'title',
      render: (user) => (
        <span className={styles.name}>
          {user.name}
          {user.id === currentUserId && (
            <Chip label={t('users.you')} size="small" variant="outlined" />
          )}
        </span>
      ),
    },
    { key: 'username', header: t('users.columns.username'), render: (user) => `@${user.username}` },
    { key: 'email', header: t('users.columns.email'), render: (user) => user.email },
    {
      key: 'role',
      header: t('users.columns.role'),
      render: (user) => (
        <Chip
          label={t(`users.role.${user.role}`)}
          size="small"
          color={user.role === 'admin' ? 'primary' : 'default'}
          variant="outlined"
        />
      ),
    },
    {
      key: 'status',
      header: t('users.columns.status'),
      render: (user) => (
        <Chip
          label={user.disabled ? t('users.status.disabled') : t('users.status.active')}
          size="small"
          color={user.disabled ? 'error' : 'success'}
          variant="outlined"
        />
      ),
    },
    {
      key: 'createdAt',
      header: t('users.columns.createdAt'),
      render: (user) => <time dateTime={user.createdAt}>{formatDate(user.createdAt)}</time>,
    },
    {
      key: 'actions',
      header: t('users.columns.actions'),
      cardPlacement: 'action',
      align: 'right',
      // No actions on your own row: you can't change your own role or disable yourself
      render: (user) =>
        user.id !== currentUserId && (
          <UserActionsMenu
            user={user}
            disabled={user.id === pendingUserId}
            onToggleRole={() => onToggleRole(user)}
            onDisable={() => onDisable(user)}
            onEnable={() => onEnable(user)}
          />
        ),
    },
  ];
}
