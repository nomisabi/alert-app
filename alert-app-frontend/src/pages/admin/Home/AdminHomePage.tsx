import { useTranslation } from 'react-i18next';
import { PageLayout } from '../../../global/components/PageLayout/PageLayout';

/** Placeholder until milestone 2 (admin: users). */
export function AdminHomePage() {
  const { t } = useTranslation();

  return <PageLayout title={t('admin.title')} description={t('admin.description')} />;
}
