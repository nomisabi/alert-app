import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { validationMessagesEn } from '../i18n/validation.en.js';
import { loginSchema, signUpFormSchema, signUpRequestSchema } from './auth.js';

const validSignUp = {
  name: 'Noemi',
  username: 'noemi.sz',
  email: 'noemi@example.com',
  password: 'secret123',
  confirmPassword: 'secret123',
};

/** Error keys per field, e.g. { username: ['username.tooShort'] }. */
function errorKeys(schema: z.ZodType, input: unknown): Record<string, string[]> {
  const result = schema.safeParse(input);
  if (result.success) return {};
  const keys: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join('.');
    keys[field] = [...(keys[field] ?? []), issue.message];
  }
  return keys;
}

function signUpErrors(changes: Partial<typeof validSignUp>) {
  return errorKeys(signUpFormSchema, { ...validSignUp, ...changes });
}

/** Every key the tests below produce. Checked against the texts at the end. */
const producedKeys = new Set<string>();
function expectKey(errors: Record<string, string[]>, field: string, key: string) {
  expect(errors[field]).toContain(key);
  producedKeys.add(key);
}

describe('signUpFormSchema', () => {
  it('accepts valid input and cleans it up', () => {
    const result = signUpFormSchema.parse({
      ...validSignUp,
      name: '  Noemi  ',
      username: ' Noemi.Sz ',
      email: '  Noemi@Example.COM ',
    });

    expect(result).toMatchObject({
      name: 'Noemi',
      username: 'Noemi.Sz',
      email: 'noemi@example.com',
    });
  });

  it('checks the display name', () => {
    expectKey(signUpErrors({ name: '   ' }), 'name', 'displayName.required');
    expectKey(signUpErrors({ name: 'a'.repeat(51) }), 'name', 'displayName.tooLong');
    expect(signUpErrors({ name: 'a'.repeat(50) })).toEqual({});
  });

  it('checks the username', () => {
    expectKey(signUpErrors({ username: '' }), 'username', 'username.required');
    expectKey(signUpErrors({ username: 'abcde' }), 'username', 'username.tooShort');
    expectKey(signUpErrors({ username: 'a'.repeat(31) }), 'username', 'username.tooLong');
    expectKey(signUpErrors({ username: 'ab cd!' }), 'username', 'username.invalidCharacters');
    expect(signUpErrors({ username: 'abcdef' })).toEqual({});
    expect(signUpErrors({ username: 'a'.repeat(30) })).toEqual({});
    expect(signUpErrors({ username: 'A_b.c9' })).toEqual({});
  });

  it('checks the email', () => {
    expectKey(signUpErrors({ email: ' ' }), 'email', 'email.required');
    expectKey(signUpErrors({ email: 'not-an-email' }), 'email', 'email.invalid');
  });

  it('checks the password rules', () => {
    const password = (value: string) => signUpErrors({ password: value, confirmPassword: value });

    expectKey(password(''), 'password', 'password.required');
    expectKey(password('abc1'), 'password', 'password.tooShort');
    expectKey(password('a1'.repeat(65)), 'password', 'password.tooLong');
    expectKey(password('12345678'), 'password', 'password.needsLetter');
    expectKey(password('password'), 'password', 'password.needsNumber');
    expect(password('pässwörd1')).toEqual({});
  });

  it('checks that the passwords match', () => {
    expectKey(signUpErrors({ confirmPassword: '' }), 'confirmPassword', 'confirmPassword.required');
    expectKey(
      signUpErrors({ confirmPassword: 'secret124' }),
      'confirmPassword',
      'confirmPassword.mismatch',
    );
  });

  it('does not send "repeat password" to the server', () => {
    const { confirmPassword, ...request } = validSignUp;

    expect(confirmPassword).toBeDefined();
    expect(signUpRequestSchema.parse(validSignUp)).toEqual(request);
  });
});

describe('loginSchema', () => {
  it('requires a valid email and a password', () => {
    expectKey(errorKeys(loginSchema, { email: '', password: 'x' }), 'email', 'email.required');
    expectKey(errorKeys(loginSchema, { email: 'nope', password: 'x' }), 'email', 'email.invalid');
    expectKey(
      errorKeys(loginSchema, { email: 'a@example.com', password: '' }),
      'password',
      'password.required',
    );
  });

  it('has no password rules, so older passwords still work', () => {
    expect(loginSchema.safeParse({ email: 'a@example.com', password: 'x' }).success).toBe(true);
  });
});

describe('validation texts', () => {
  it('has exactly one text for every error key the schemas use', () => {
    // All text keys, e.g. "username.tooShort". "invalid" is the backend's fallback, not a schema key.
    // "search" is checked in admin-users.test.ts.
    const textKeys = Object.entries(validationMessagesEn)
      .flatMap(([group, texts]) =>
        typeof texts === 'string' ? [group] : Object.keys(texts).map((key) => `${group}.${key}`),
      )
      .filter((key) => key !== 'invalid' && !key.startsWith('search.'));

    expect([...producedKeys].sort()).toEqual(textKeys.sort());
  });
});
