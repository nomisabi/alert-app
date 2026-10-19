import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { AppBar, Container, Toolbar, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link, Outlet } from 'react-router';
import styles from './AppLayout.module.scss';

export function AppLayout() {
  const { t } = useTranslation();

  return (
    <div className={styles.layout}>
      {/* Hidden until focused with Tab: lets keyboard users jump past the AppBar */}
      <a href="#main-content" className={styles.skipLink}>
        {t('app.skipToContent')}
      </a>
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
      {/* tabIndex -1: the skip link can move focus here */}
      <Container
        component="main"
        id="main-content"
        tabIndex={-1}
        maxWidth="lg"
        className={styles.content}
      >
        <Outlet />
      </Container>
    </div>
  );
}
