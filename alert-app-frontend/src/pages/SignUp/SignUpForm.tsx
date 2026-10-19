import {
  PASSWORD_MIN_LENGTH,
  signUpFormSchema,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  type SignUpFormValues,
} from '@alert-app/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button } from '@mui/material';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useCheckUsername } from '../../api/sign-up/useCheckUsername';
import { FormTextField } from '../../global/components/FormTextField/FormTextField';
import { useNotify } from '../../global/hooks/useNotify';
import { setServerErrors } from '../../global/utils/setServerErrors';
import type { SignUpFormProps } from '../../types/sign-up/signUpForm';
import styles from './SignUpPage.module.scss';

const defaultValues: SignUpFormValues = {
  name: '',
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export function SignUpForm({ onSubmit }: SignUpFormProps) {
  const { t } = useTranslation('auth');
  const notify = useNotify();
  const checkUsernameAvailable = useCheckUsername();
  const form = useForm({
    resolver: zodResolver(signUpFormSchema),
    mode: 'onTouched',
    defaultValues,
  });
  const {
    control,
    handleSubmit,
    trigger,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      setServerErrors(error, form);
    }
  });

  // When leaving the username field: ask the server whether it's free (only if the rules pass)
  const checkUsername = async () => {
    if (!(await trigger('username'))) return;
    try {
      const { available } = await checkUsernameAvailable(getValues('username').trim());
      if (!available) {
        setError('username', { type: 'server', message: t('fields.usernameTaken') });
      }
    } catch {
      // The form still works: the server checks the username again on submit
      notify(t('fields.usernameCheckFailed'), 'warning');
    }
  };

  return (
    // noValidate: we show our own messages instead of the browser's validation bubbles
    <form className={styles.form} onSubmit={submit} noValidate>
      <FormTextField
        control={control}
        name="name"
        label={t('fields.displayName')}
        helperText={t('fields.displayNameHint')}
        autoComplete="name"
        required
      />
      <FormTextField
        control={control}
        name="username"
        label={t('fields.username')}
        helperText={t('fields.usernameHint', {
          min: USERNAME_MIN_LENGTH,
          max: USERNAME_MAX_LENGTH,
        })}
        // Login is by email, so password managers should not save this as the login name
        autoComplete="off"
        onBlur={() => void checkUsername()}
        required
      />
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
        helperText={t('fields.passwordHint', { min: PASSWORD_MIN_LENGTH })}
        autoComplete="new-password"
        required
      />
      <FormTextField
        control={control}
        name="confirmPassword"
        type="password"
        label={t('fields.confirmPassword')}
        autoComplete="new-password"
        required
      />
      {errors.root?.server && <Alert severity="error">{errors.root.server.message}</Alert>}
      <Button type="submit" variant="contained" size="large" loading={isSubmitting}>
        {t('signUp.submit')}
      </Button>
    </form>
  );
}
