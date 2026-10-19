import { Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './PageLayout.module.scss';

interface PageLayoutProps {
  title: string;
  description?: string;
  /** Buttons shown next to the title (below it on mobile). */
  actions?: ReactNode;
  children?: ReactNode;
}

/** Common page frame: browser tab title, h1 heading, optional description and actions. */
export function PageLayout({ title, description, actions, children }: PageLayoutProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* React 19 moves <title> into the document head */}
      <title>{t('app.pageTitle', { page: title })}</title>
      <header className={styles.header}>
        <div>
          <Typography variant="h4" component="h1">
            {title}
          </Typography>
          {description && (
            <Typography color="text.secondary" className={styles.description}>
              {description}
            </Typography>
          )}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      {children}
    </>
  );
}
