import MoreVertIcon from '@mui/icons-material/MoreVert';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UserActionsMenuProps } from '../../../types/admin/users';

/** "⋮" button of one user row: change role, disable or enable. */
export function UserActionsMenu({
  user,
  disabled = false,
  onToggleRole,
  onDisable,
  onEnable,
}: UserActionsMenuProps) {
  const { t } = useTranslation('admin');
  const menuId = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const choose = (action: () => void) => () => {
    setAnchor(null);
    action();
  };

  return (
    <>
      <IconButton
        size="small"
        aria-label={t('users.actions.menu', { name: user.name })}
        aria-controls={anchor ? menuId : undefined}
        aria-haspopup="true"
        aria-expanded={anchor ? 'true' : undefined}
        disabled={disabled}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        <MoreVertIcon />
      </IconButton>
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={choose(onToggleRole)}>
          {user.role === 'admin' ? t('users.actions.removeAdmin') : t('users.actions.makeAdmin')}
        </MenuItem>
        {user.disabled ? (
          <MenuItem onClick={choose(onEnable)}>{t('users.actions.enable')}</MenuItem>
        ) : (
          <MenuItem onClick={choose(onDisable)}>{t('users.actions.disable')}</MenuItem>
        )}
      </Menu>
    </>
  );
}
