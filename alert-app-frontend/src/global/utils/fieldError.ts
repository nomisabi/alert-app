import { VALIDATION_VALUES } from '@alert-app/shared';
import type { ParseKeys } from 'i18next';
import type { FieldError } from 'react-hook-form';
import i18n from '../../i18n';

/**
 * The text to show under a form field.
 * A Zod error is a key of the `validation` namespace and is translated here,
 * a server error (`type: 'server'`) is already translated by the backend.
 */
export function fieldErrorText(error: FieldError | undefined): string | undefined {
  if (!error?.message) return undefined;
  if (error.type === 'server') return error.message;
  return i18n.t(error.message as ParseKeys<'validation'>, {
    ns: 'validation',
    ...VALIDATION_VALUES,
  });
}
