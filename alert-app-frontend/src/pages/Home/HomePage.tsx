import EmailIcon from '@mui/icons-material/Email';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TuneIcon from '@mui/icons-material/Tune';
import { Card, CardContent, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { PageLayout } from '../../global/components/PageLayout/PageLayout';
import styles from './HomePage.module.scss';

const features = [
  { key: 'rules', Icon: TuneIcon },
  { key: 'channels', Icon: EmailIcon },
  { key: 'frequency', Icon: ScheduleIcon },
] as const;

export function HomePage() {
  const { t } = useTranslation();

  return (
    <PageLayout title={t('home.title')} description={t('home.description')}>
      <ul className={styles.features}>
        {features.map(({ key, Icon }) => (
          <li key={key}>
            <Card variant="outlined" className={styles.card}>
              <CardContent>
                <Icon color="primary" fontSize="large" />
                <Typography variant="h6" component="h2" gutterBottom>
                  {t(`home.features.${key}.title`)}
                </Typography>
                <Typography color="text.secondary">{t(`home.features.${key}.text`)}</Typography>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </PageLayout>
  );
}
