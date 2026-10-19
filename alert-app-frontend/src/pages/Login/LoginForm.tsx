import { loginSchema, type LoginFormValues } from '@alert-app/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button } from '@mui/material';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { FormTextField } from '../../global/components/FormTextField/FormTextField';
import { setServerErrors } from '../../global/utils/setServerErrors';
import styles from './LoginPage.module.scss';

const defaultValues: LoginFormValues = { email: '', password: '' };

interface LoginFormProps {
  /** Throws an ApiRequestError when the server rejects the login. */
  onSubmit: (values: z.output<typeof loginSchema>) => Promise<unknown>;
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const { t } = useTranslation('auth');
  const form = useForm({ resolver: zodResolver(loginSchema), mode: 'onTouched', defaultValues });
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      setServerErrors(error, form);
    }
  });

  return (
    // noValidate: we show our own messages instead of the browser's validation bubbles
    <form className={styles.form} onSubmit={submit} noValidate>
      <FormTextField
        control={control}
        name="email"
        type="email"
        label={t('fields.email')}
        autoComplete="email"
        required
      />
      <FormTextField
        control={control}
        name="password"
        type="password"
        label={t('fields.password')}
        autoComplete="current-password"
        required
      />
      {errors.root?.server && <Alert severity="error">{errors.root.server.message}</Alert>}
      <Button type="submit" variant="contained" size="large" loading={isSubmitting}>
        {t('login.submit')}
      </Button>
    </form>
  );
}
