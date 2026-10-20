import { Typography } from '@mui/material';
import type { ReactNode } from 'react';
import styles from './EmptyState.module.scss';

interface EmptyStateProps {
  /** A large MUI icon, e.g. <NotificationsNoneIcon />. Decorative only. */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Usually one button that creates the first item. */
  action?: ReactNode;
}

/** Shown instead of an empty list: what's missing and how to add the first item. */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <section className={styles.emptyState}>
      {icon && (
        <div className={styles.icon} aria-hidden="true">
          {icon}
        </div>
      )}
      <Typography variant="h6" component="h2">
        {title}
      </Typography>
      {description && (
        <Typography color="text.secondary" className={styles.description}>
          {description}
        </Typography>
      )}
      {action && <div className={styles.action}>{action}</div>}
    </section>
  );
}
