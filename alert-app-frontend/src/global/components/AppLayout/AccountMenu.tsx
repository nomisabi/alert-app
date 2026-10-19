import type { AuthUser } from '@alert-app/shared';
import AccountCircle from '@mui/icons-material/AccountCircle';
import { Button, Divider, ListItemText, Menu, MenuItem } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { useNotify } from '../../hooks/useNotify';
import { sessionQueryKey } from '../../hooks/useSession';
import { signOut } from '../../utils/authApi';
import styles from './AppLayout.module.scss';

/** AppBar button with the user's name. Opens a menu with the admin link and "Log out". */
export function AccountMenu({ user }: { user: AuthUser }) {
  const { t } = useTranslation('auth');
  const menuId = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const notify = useNotify();

  const logout = useMutation({
    mutationFn: () => signOut(),
    onSuccess: async () => {
      // Tell every component using useSession() (e.g. this AppBar) right away. queryClient.clear()
      // is not enough: it removes the data, but components already on screen keep showing it.
      queryClient.setQueryData(sessionQueryKey, null);
      // Forget everything else cached for this user
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== sessionQueryKey[0] });
      await navigate('/login');
      notify(t('account.loggedOut'));
    },
    onError: (error) => notify(error.message, 'error'),
  });

  const close = () => setAnchor(null);

  return (
    <>
      <Button
        color="inherit"
        startIcon={<AccountCircle />}
        aria-label={t('account.menu', { name: user.name })}
        aria-controls={anchor ? menuId : undefined}
        aria-haspopup="true"
        aria-expanded={anchor ? 'true' : undefined}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        <span className={styles.userName}>{user.name}</span>
      </Button>
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <ListItemText
          className={styles.menuHeader}
          primary={user.name}
          secondary={`@${user.displayUsername}`}
        />
        <Divider />
        {user.role === 'admin' && (
          <MenuItem component={Link} to="/admin" onClick={close}>
            {t('account.admin')}
          </MenuItem>
        )}
        <MenuItem
          disabled={logout.isPending}
          onClick={() => {
            close();
            logout.mutate();
          }}
        >
          {t('account.logout')}
        </MenuItem>
      </Menu>
    </>
  );
}
