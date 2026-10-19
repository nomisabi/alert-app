import { useContext } from 'react';
import {
  NotificationContext,
  type Notify,
} from '../components/NotificationProvider/notificationContext';

/**
 * Shows a short message in a snackbar.
 *
 * @example
 * const notify = useNotify();
 * notify(t('alerts.saved'));
 * notify(t('alerts.saveFailed'), 'error');
 */
export function useNotify(): Notify {
  const notify = useContext(NotificationContext);
  if (!notify) throw new Error('useNotify must be used inside <NotificationProvider>');
  return notify;
}
