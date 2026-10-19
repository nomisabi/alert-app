import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import i18n from '../../i18n';
import { ApiRequestError } from './apiFetch';

/** Form-level error (no field), shown above the submit button. */
export const SERVER_ERROR = 'root.server';

/**
 * Shows a failed request in a React Hook Form form:
 * - each `fieldErrors` entry under its field (the first one gets focus)
 * - otherwise the general `message` as a form-level error (`errors.root.server`)
 * The messages are already translated by the backend.
 */
export function setServerErrors<T extends FieldValues>(
  error: unknown,
  form: Pick<UseFormReturn<T>, 'setError' | 'getValues'>,
) {
  const body =
    error instanceof ApiRequestError
      ? error.body
      : { code: 'UNKNOWN_ERROR', message: i18n.t('errors.unexpected') };

  const formFields = Object.keys(form.getValues());
  const fieldErrors = (body.fieldErrors ?? []).filter(({ field }) => formFields.includes(field));

  fieldErrors.forEach(({ field, message }, index) => {
    form.setError(field as Path<T>, { type: 'server', message }, { shouldFocus: index === 0 });
  });

  if (fieldErrors.length === 0) {
    form.setError(SERVER_ERROR, { type: 'server', message: body.message });
  }
}
