import { Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        {t('notFound.title')}
      </Typography>
      <Typography color="text.secondary" gutterBottom>
        {t('notFound.description')}
      </Typography>
      <Button component={Link} to="/" variant="contained">
        {t('notFound.backHome')}
      </Button>
    </>
  );
}
