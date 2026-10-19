import { Link as MuiLink } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useSearchParams } from 'react-router';
import { useSession } from '../../api/auth/useSession';
import { useSignIn } from '../../api/login/useSignIn';
import { AuthLayout } from '../../global/components/AuthLayout/AuthLayout';
import { LoginForm } from './LoginForm';

export function LoginPage() {
  const { t } = useTranslation('auth');
  const { user } = useSession();
  const [searchParams] = useSearchParams();
  const login = useSignIn();

  // Logged in (already, or just now): go back to the page that asked for login, or Home.
  // After a successful login useSignIn reloads the session, so `user` gets set here.
  if (user) return <Navigate to={safeRedirect(searchParams.get('redirectTo'))} replace />;

  return (
    <AuthLayout
      title={t('login.title')}
      description={t('login.description')}
      footer={
        <>
          {t('login.noAccount')}{' '}
          <MuiLink component={Link} to="/signup">
            {t('login.signUpLink')}
          </MuiLink>
        </>
      }
    >
      <LoginForm onSubmit={login.mutateAsync} />
    </AuthLayout>
  );
}

/** Only paths inside this app, so a link like /login?redirectTo=https://evil.example can't send users away. */
function safeRedirect(redirectTo: string | null): string {
  if (!redirectTo?.startsWith('/') || redirectTo.startsWith('//')) return '/';
  return redirectTo;
}
