import { Link as MuiLink } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router';
import { AuthLayout } from '../../global/components/AuthLayout/AuthLayout';
import { sessionQueryKey, useSession } from '../../global/hooks/useSession';
import { signUp } from '../../global/utils/authApi';
import { SignUpForm } from './SignUpForm';

export function SignUpPage() {
  const { t } = useTranslation('auth');
  const { user } = useSession();
  const queryClient = useQueryClient();

  const register = useMutation({
    // "Repeat password" is only checked in the browser, so it isn't sent
    mutationFn: ({ name, username, email, password }: Parameters<typeof signUp>[0]) =>
      signUp({ name, username, email, password }),
    // Sign-up also logs in: reload the session, then the <Navigate> below goes to Home
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionQueryKey }),
  });

  if (user) return <Navigate to="/" replace />;

  return (
    <AuthLayout
      title={t('signUp.title')}
      description={t('signUp.description')}
      footer={
        <>
          {t('signUp.hasAccount')}{' '}
          <MuiLink component={Link} to="/login">
            {t('signUp.loginLink')}
          </MuiLink>
        </>
      }
    >
      <SignUpForm onSubmit={register.mutateAsync} />
    </AuthLayout>
  );
}
