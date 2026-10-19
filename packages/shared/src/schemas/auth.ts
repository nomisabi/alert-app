import { z } from 'zod';
import {
  DISPLAY_NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  ROLES,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from '../constants/auth.js';

/**
 * Auth rules shared by the frontend (form validation) and the backend (request validation).
 * Error messages are i18n keys of the `validation` namespace (see i18n/validation.en.ts), not English text.
 */

export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'displayName.required')
  .max(DISPLAY_NAME_MAX_LENGTH, 'displayName.tooLong');

export const usernameSchema = z
  .string()
  .trim()
  .min(1, 'username.required')
  .min(USERNAME_MIN_LENGTH, 'username.tooShort')
  .max(USERNAME_MAX_LENGTH, 'username.tooLong')
  .regex(USERNAME_PATTERN, 'username.invalidCharacters');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'email.required')
  .pipe(z.email('email.invalid'));

/** Rules for a new password (sign-up). */
export const newPasswordSchema = z
  .string()
  .min(1, 'password.required')
  .min(PASSWORD_MIN_LENGTH, 'password.tooShort')
  .max(PASSWORD_MAX_LENGTH, 'password.tooLong')
  .regex(/\p{L}/u, 'password.needsLetter')
  .regex(/\d/, 'password.needsNumber');

/** Body of POST /api/auth/sign-up/email (what the backend receives). */
export const signUpRequestSchema = z.object({
  name: displayNameSchema,
  username: usernameSchema,
  email: emailSchema,
  password: newPasswordSchema,
});
export type SignUpRequest = z.infer<typeof signUpRequestSchema>;

/** Sign-up form: the request plus "repeat password", which is only checked in the browser. */
export const signUpFormSchema = signUpRequestSchema
  .extend({ confirmPassword: z.string().min(1, 'confirmPassword.required') })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'confirmPassword.mismatch',
    path: ['confirmPassword'],
  });
export type SignUpFormValues = z.input<typeof signUpFormSchema>;

/** Login form and body of POST /api/auth/sign-in/email. No password rules: they may change later. */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'password.required'),
});
export type LoginFormValues = z.input<typeof loginSchema>;
