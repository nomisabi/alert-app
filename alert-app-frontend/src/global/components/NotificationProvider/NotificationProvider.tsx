import { Alert, Snackbar } from '@mui/material';
import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NotificationContext, type NotificationSeverity } from './notificationContext';

interface Notification {
  /** Changes for every message, so a new message restarts the auto-hide timer. */
  id: number;
  message: string;
  severity: NotificationSeverity;
}

/** Shows one snackbar message at a time. Components trigger it with `useNotify()`. */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [notification, setNotification] = useState<Notification | null>(null);
  const [open, setOpen] = useState(false);

  const notify = useCallback((message: string, severity: NotificationSeverity = 'success') => {
    setNotification({ id: Date.now(), message, severity });
    setOpen(true);
  }, []);

  const handleClose = (_event?: unknown, reason?: string) => {
    // A click somewhere else on the page should not hide the message
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  return (
    <NotificationContext value={notify}>
      {children}
      <Snackbar
        key={notification?.id}
        open={open}
        autoHideDuration={5000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {/* Alert has role="alert", so screen readers read the message out */}
        <Alert
          severity={notification?.severity}
          variant="filled"
          onClose={handleClose}
          closeText={t('notifications.close')}
        >
          {notification?.message}
        </Alert>
      </Snackbar>
    </NotificationContext>
  );
}
