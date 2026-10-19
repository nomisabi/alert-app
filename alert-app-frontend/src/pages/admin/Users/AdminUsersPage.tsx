import {
  DEFAULT_PAGE_SIZE,
  USER_SEARCH_MAX_LENGTH,
  type AdminUser,
  type UpdateAdminUserRequest,
} from '@alert-app/shared';
import SearchIcon from '@mui/icons-material/Search';
import { InputAdornment, TextField } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminUsers } from '../../../api/admin/useAdminUsers';
import { useUpdateAdminUser } from '../../../api/admin/useUpdateAdminUser';
import { useSession } from '../../../api/auth/useSession';
import { getUserColumns } from '../../../utils/admin/userColumns';
import { ConfirmDialog } from '../../../global/components/ConfirmDialog/ConfirmDialog';
import { DataTable } from '../../../global/components/DataTable/DataTable';
import { PageLayout } from '../../../global/components/PageLayout/PageLayout';
import { useNotify } from '../../../global/hooks/useNotify';
import styles from './AdminUsersPage.module.scss';
import { useDebouncedValue } from './useDebouncedValue';

const pageSize = DEFAULT_PAGE_SIZE;

export function AdminUsersPage() {
  const { t } = useTranslation('admin');
  const { user: currentUser } = useSession();
  const notify = useNotify();

  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [page, setPage] = useState(1);
  const [userToDisable, setUserToDisable] = useState<AdminUser | null>(null);

  const users = useAdminUsers({ search, page, pageSize });
  const update = useUpdateAdminUser();

  const changeUser = (user: AdminUser, changes: UpdateAdminUserRequest) =>
    update.mutate(
      { user, changes },
      {
        onSuccess: (updated) => {
          setUserToDisable(null);
          notify(t(successMessage(changes), { name: updated.name }));
        },
        onError: (error) => notify(error.message, 'error'),
      },
    );

  const columns = getUserColumns({
    t,
    currentUserId: currentUser?.id,
    pendingUserId: update.isPending ? update.variables.user.id : undefined,
    onToggleRole: (user) => changeUser(user, { role: user.role === 'admin' ? 'user' : 'admin' }),
    onDisable: setUserToDisable,
    onEnable: (user) => changeUser(user, { disabled: false }),
  });

  return (
    <PageLayout title={t('users.title')} description={t('users.description')}>
      <TextField
        type="search"
        label={t('users.search.label')}
        placeholder={t('users.search.placeholder')}
        value={searchInput}
        onChange={(event) => {
          setSearchInput(event.target.value);
          setPage(1);
        }}
        className={styles.search}
        slotProps={{
          htmlInput: { maxLength: USER_SEARCH_MAX_LENGTH },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          },
        }}
      />

      <DataTable
        label={t('users.table.label')}
        columns={columns}
        rows={users.data?.items ?? []}
        getRowKey={(user) => user.id}
        total={users.data?.total ?? 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        isLoading={users.isPending}
        isFetching={users.isPlaceholderData}
        errorMessage={users.isError ? t('users.loadError') : undefined}
        onRetry={() => void users.refetch()}
        emptyText={search ? t('users.noResults', { search }) : t('users.empty')}
      />

      <ConfirmDialog
        open={Boolean(userToDisable)}
        title={t('users.disableDialog.title', { name: userToDisable?.name })}
        description={t('users.disableDialog.description', { name: userToDisable?.name })}
        confirmLabel={t('users.disableDialog.confirm')}
        destructive
        isPending={update.isPending}
        onConfirm={() => userToDisable && changeUser(userToDisable, { disabled: true })}
        onClose={() => setUserToDisable(null)}
      />
    </PageLayout>
  );
}

function successMessage(changes: UpdateAdminUserRequest) {
  if (changes.disabled === true) return 'users.notify.disabled';
  if (changes.disabled === false) return 'users.notify.enabled';
  return changes.role === 'admin' ? 'users.notify.madeAdmin' : 'users.notify.removedAdmin';
}
