import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { IconButton, InputAdornment, TextField, type TextFieldProps } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { fieldErrorText } from '../../utils/fieldError';

/** `TOutput`: what the form hands to its submit handler, when the schema changes the values' shape. */
type FormTextFieldProps<T extends FieldValues, TOutput extends FieldValues> = Omit<
  TextFieldProps,
  'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'error' | 'inputRef'
> & {
  control: Control<T, unknown, TOutput>;
  name: FieldPath<T>;
  onBlur?: () => void;
};

/**
 * MUI TextField connected to React Hook Form.
 * Shows the field's error instead of the helper text: a Zod error is a key of the `validation`
 * namespace and is translated here, a server error (`type: 'server'`) is already translated.
 * `type="password"` adds a show/hide button. `onBlur` runs after React Hook Form's own blur handling.
 */
export function FormTextField<T extends FieldValues, TOutput extends FieldValues = T>({
  control,
  name,
  type,
  helperText,
  slotProps,
  onBlur,
  ...props
}: FormTextFieldProps<T, TOutput>) {
  const { t } = useTranslation(['validation', 'auth']);
  const {
    field: { ref, ...field },
    fieldState: { error },
  } = useController({ control, name });
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === 'password';
  const errorText = fieldErrorText(error);

  const passwordToggle = (
    <InputAdornment position="end">
      <IconButton
        aria-label={showPassword ? t('auth:fields.hidePassword') : t('auth:fields.showPassword')}
        aria-pressed={showPassword}
        onClick={() => setShowPassword((shown) => !shown)}
        edge="end"
      >
        {showPassword ? <VisibilityOff /> : <Visibility />}
      </IconButton>
    </InputAdornment>
  );

  return (
    <TextField
      {...props}
      {...field}
      // Keep the input controlled even before the user types
      value={field.value ?? ''}
      inputRef={ref}
      onBlur={() => {
        field.onBlur();
        onBlur?.();
      }}
      type={isPassword && showPassword ? 'text' : type}
      error={Boolean(error)}
      helperText={errorText ?? helperText}
      fullWidth
      slotProps={{
        ...slotProps,
        input: isPassword ? { endAdornment: passwordToggle } : slotProps?.input,
      }}
    />
  );
}
