/**
 * Texts for API error codes (the `errors` i18n namespace). The key is the `code` in the error response.
 * Codes without a text here fall back to the text for their HTTP status (see i18n.ts).
 */
export const errorsEn = {
  // Generic, by HTTP status
  BAD_REQUEST: 'The request is not valid.',
  UNAUTHORIZED: 'Please log in to continue.',
  FORBIDDEN: "You don't have permission to do this.",
  NOT_FOUND: 'Not found.',
  UNPROCESSABLE_ENTITY: 'The request could not be processed.',
  TOO_MANY_REQUESTS: 'Too many attempts. Please wait a moment and try again.',
  INTERNAL_SERVER_ERROR: 'Something went wrong. Please try again later.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again later.',

  // Ours
  VALIDATION_FAILED: 'Please check the highlighted fields.',

  // Better Auth
  INVALID_EMAIL_OR_PASSWORD: 'Invalid email or password.',
  USER_ALREADY_EXISTS: 'An account with this email already exists.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'An account with this email already exists.',
  USERNAME_IS_ALREADY_TAKEN: 'This username is already taken.',
} as const;
