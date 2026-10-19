import { Link as MuiLink } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router';
import { useSession } from '../../api/auth/useSession';
import { useSignUp } from '../../api/sign-up/useSignUp';
import { AuthLayout } from '../../global/components/AuthLayout/AuthLayout';
import { SignUpForm } from './SignUpForm';

export function SignUpPage() {
  const { t } = useTranslation('auth');
  const { user } = useSession();
  const register = useSignUp();

  // Sign-up also logs in: useSignUp reloads the session, then this goes to Home
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
