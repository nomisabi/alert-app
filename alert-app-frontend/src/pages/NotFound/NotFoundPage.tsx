import { Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PageLayout } from '../../global/components/PageLayout/PageLayout';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <PageLayout title={t('notFound.title')} description={t('notFound.description')}>
      <Button component={Link} to="/" variant="contained">
        {t('notFound.backHome')}
      </Button>
    </PageLayout>
  );
}
