import { Button, Container } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { PageLayout } from '../../global/components/PageLayout/PageLayout';
import styles from './ErrorPage.module.scss';

interface ErrorPageProps {
  /** Set when the layout itself failed: the page then renders its own <main> without the AppBar. */
  withoutLayout?: boolean;
}

/** Shown by React Router (`errorElement`) when a route throws while rendering. */
export function ErrorPage({ withoutLayout = false }: ErrorPageProps) {
  const { t } = useTranslation();
  const error = useRouteError();

  const content = (
    <PageLayout title={t('error.title')} description={t('error.description')}>
      <div className={styles.actions}>
        <Button variant="contained" onClick={() => window.location.reload()}>
          {t('error.tryAgain')}
        </Button>
        <Button component={Link} to="/" variant="outlined">
          {t('error.backHome')}
        </Button>
      </div>
      {import.meta.env.DEV && (
        <details className={styles.details}>
          <summary>{t('error.details')}</summary>
          <pre className={styles.stack}>{describeError(error)}</pre>
        </details>
      )}
    </PageLayout>
  );

  if (withoutLayout) {
    return (
      <Container component="main" maxWidth="lg" className={styles.standalone}>
        {content}
      </Container>
    );
  }

  return content;
}

function describeError(error: unknown): string {
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`;
  if (error instanceof Error) return error.stack ?? error.message;
  return String(error);
}
