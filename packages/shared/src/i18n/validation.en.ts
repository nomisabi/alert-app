import { USER_SEARCH_MAX_LENGTH } from '../constants/admin-users.js';
import {
  ALERT_RULE_NAME_MAX_LENGTH,
  KEYWORD_MAX_LENGTH,
  KEYWORD_MIN_LENGTH,
  KEYWORDS_MAX,
} from '../constants/alert-rules.js';
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
  search: {
    tooLong: 'Use at most {{searchMax}} characters.',
  },
  alertRuleName: {
    required: 'Enter a name for this alert.',
    tooLong: 'Use at most {{alertRuleNameMax}} characters.',
  },
  alertRuleType: {
    required: 'Choose how this alert finds news.',
  },
  keywords: {
    required: 'Add at least one keyword.',
    tooMany: 'Use at most {{keywordsMax}} keywords.',
    duplicate: 'Each keyword can be added only once.',
  },
  keyword: {
    tooShort: 'Each keyword needs at least {{keywordMin}} characters.',
    tooLong: 'Each keyword can have at most {{keywordMax}} characters.',
  },
  category: {
    required: 'Choose a category.',
  },
} as const;

/** Values the validation texts can use, e.g. "Use at least {{usernameMin}} characters." */
export const VALIDATION_VALUES = {
  displayNameMax: DISPLAY_NAME_MAX_LENGTH,
  usernameMin: USERNAME_MIN_LENGTH,
  usernameMax: USERNAME_MAX_LENGTH,
  passwordMin: PASSWORD_MIN_LENGTH,
  passwordMax: PASSWORD_MAX_LENGTH,
  searchMax: USER_SEARCH_MAX_LENGTH,
  alertRuleNameMax: ALERT_RULE_NAME_MAX_LENGTH,
  keywordsMax: KEYWORDS_MAX,
  keywordMin: KEYWORD_MIN_LENGTH,
  keywordMax: KEYWORD_MAX_LENGTH,
};
