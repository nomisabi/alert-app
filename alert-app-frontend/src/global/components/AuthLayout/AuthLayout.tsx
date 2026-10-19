import { Paper } from '@mui/material';
import type { ReactNode } from 'react';
import { PageLayout } from '../PageLayout/PageLayout';
import styles from './AuthLayout.module.scss';

interface AuthLayoutProps {
  title: string;
  description?: string;
  /** Shown below the card, e.g. "Don't have an account? Sign up". */
  footer?: ReactNode;
  children: ReactNode;
}

/** Narrow, centered card for the login and sign-up pages. */
export function AuthLayout({ title, description, footer, children }: AuthLayoutProps) {
  return (
    <div className={styles.wrapper}>
      <Paper variant="outlined" className={styles.card}>
        <PageLayout title={title} description={description}>
          {children}
        </PageLayout>
      </Paper>
      {footer && <p className={styles.footer}>{footer}</p>}
    </div>
  );
}
