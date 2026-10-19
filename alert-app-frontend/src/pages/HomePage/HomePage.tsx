import { Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../lib/date';

export function HomePage() {
  const { t } = useTranslation();

  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        {t('home.title')}
      </Typography>
      <Typography color="text.secondary">
        {t('home.today', { date: formatDate(new Date(), 'PPPP') })}
      </Typography>
    </>
  );
}
