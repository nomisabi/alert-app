import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { AppBar, Container, Toolbar, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link, Outlet } from 'react-router';
import styles from './AppLayout.module.scss';

export function AppLayout() {
  const { t } = useTranslation();

  return (
    <div className={styles.layout}>
      <AppBar position="static">
        <Toolbar>
          <Link to="/" className={styles.brand}>
            <NotificationsActiveIcon />
            <Typography variant="h6" component="span">
              {t('app.name')}
            </Typography>
          </Link>
        </Toolbar>
      </AppBar>
      <Container component="main" maxWidth="lg" className={styles.content}>
        <Outlet />
      </Container>
    </div>
  );
}
