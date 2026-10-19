import {
  DISPLAY_NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from '../constants/auth.js';

/**
 * Texts for the Zod error keys in this package (the `validation` i18n namespace).
 * Shared, because the frontend shows them under form fields and the backend returns them in `fieldErrors`.
 * Adding a language: add an object with the same keys.
 */
export const validationMessagesEn = {
  invalid: 'This value is not valid.',
  displayName: {
    required: 'Enter a display name.',
    tooLong: 'Use at most {{displayNameMax}} characters.',
  },
  username: {
    required: 'Enter a username.',
    tooShort: 'Use at least {{usernameMin}} characters.',
    tooLong: 'Use at most {{usernameMax}} characters.',
    invalidCharacters: 'Use only letters, numbers, _ and .',
  },
  email: {
    required: 'Enter your email address.',
    invalid: 'Enter a valid email address, e.g. name@example.com.',
  },
  password: {
    required: 'Enter a password.',
    tooShort: 'Use at least {{passwordMin}} characters.',
    tooLong: 'Use at most {{passwordMax}} characters.',
    needsLetter: 'Add at least one letter.',
    needsNumber: 'Add at least one number.',
  },
  confirmPassword: {
    required: 'Repeat your password.',
    mismatch: "The passwords don't match.",
  },
} as const;

/** Values the validation texts can use, e.g. "Use at least {{usernameMin}} characters." */
export const VALIDATION_VALUES = {
  displayNameMax: DISPLAY_NAME_MAX_LENGTH,
  usernameMin: USERNAME_MIN_LENGTH,
  usernameMax: USERNAME_MAX_LENGTH,
  passwordMin: PASSWORD_MIN_LENGTH,
  passwordMax: PASSWORD_MAX_LENGTH,
};
