import type { AuthUser } from '@alert-app/shared';
import AccountCircle from '@mui/icons-material/AccountCircle';
import { Button, Divider, ListItemText, Menu, MenuItem } from '@mui/material';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { useSignOut } from '../../../api/auth/useSignOut';
import { useNotify } from '../../hooks/useNotify';
import styles from './AppLayout.module.scss';

/** AppBar button with the user's name. Opens a menu with the admin link and "Log out". */
export function AccountMenu({ user }: { user: AuthUser }) {
  const { t } = useTranslation('auth');
  const menuId = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();
  const notify = useNotify();
  const signOut = useSignOut();

  // mutateAsync + await (not mutate's onSuccess): this menu unmounts as soon as the session is gone
  const logOut = async () => {
    try {
      await signOut.mutateAsync();
      await navigate('/login');
      notify(t('account.loggedOut'));
    } catch (error) {
      notify((error as Error).message, 'error');
    }
  };

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
          disabled={signOut.isPending}
          onClick={() => {
            close();
            void logOut();
          }}
        >
          {t('account.logout')}
        </MenuItem>
      </Menu>
    </>
  );
}
