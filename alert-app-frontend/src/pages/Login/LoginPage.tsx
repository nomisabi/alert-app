import { Link as MuiLink } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useSearchParams } from 'react-router';
import { AuthLayout } from '../../global/components/AuthLayout/AuthLayout';
import { sessionQueryKey, useSession } from '../../global/hooks/useSession';
import { signIn } from '../../global/utils/authApi';
import { LoginForm } from './LoginForm';

export function LoginPage() {
  const { t } = useTranslation('auth');
  const { user } = useSession();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const login = useMutation({
    // Not `mutationFn: signIn`: TanStack Query passes a second argument we don't want to send
    mutationFn: (values: Parameters<typeof signIn>[0]) => signIn(values),
    // Reload the session: `user` is then set and the <Navigate> below sends the user on
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionQueryKey }),
  });

  // Logged in (already, or just now): go back to the page that asked for login, or Home
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
