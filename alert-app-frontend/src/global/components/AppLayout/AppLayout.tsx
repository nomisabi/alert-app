import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { AppBar, Button, Container, Toolbar, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet } from 'react-router';
import { useSession } from '../../../api/auth/useSession';
import { AccountMenu } from './AccountMenu';
import styles from './AppLayout.module.scss';

export function AppLayout() {
  const { t } = useTranslation(['common', 'auth']);
  const { user, isPending } = useSession();

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
            {/* Hidden on phones to make room, but still the link's name for screen readers */}
            <Typography variant="h6" component="span" className={styles.brandText}>
              {t('app.name')}
            </Typography>
          </Link>
          <nav className={styles.nav} aria-label={t('auth:nav.label')}>
            {/* Nothing while the session loads, so the buttons don't flash */}
            {!isPending && user && (
              <>
                <Button component={NavLink} to="/alerts" color="inherit" size="small">
                  {t('nav.myAlerts')}
                </Button>
                <AccountMenu user={user} />
              </>
            )}
            {!isPending && !user && (
              <>
                <Button component={Link} to="/login" color="inherit" size="small">
                  {t('auth:nav.login')}
                </Button>
                <Button
                  component={Link}
                  to="/signup"
                  color="inherit"
                  variant="outlined"
                  size="small"
                >
                  {t('auth:nav.signUp')}
                </Button>
              </>
            )}
          </nav>
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
