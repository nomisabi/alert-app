import { signUpRequestSchema } from '@alert-app/shared';
import { ApiException, parseBody } from './api.exception.js';

describe('parseBody', () => {
  const validBody = {
    name: 'Noemi',
    username: 'noemi.sz',
    email: ' Noemi@Example.com ',
    password: 'secret123',
  };

  it('returns the parsed body, without unknown fields', () => {
    expect(parseBody(signUpRequestSchema, { ...validBody, role: 'admin' })).toEqual({
      ...validBody,
      email: 'noemi@example.com',
    });
  });

  it('throws 400 VALIDATION_FAILED with one error per field', () => {
    let error: unknown;
    try {
      // "abc": too short, but the characters are fine → only one error for the field
      parseBody(signUpRequestSchema, { ...validBody, username: 'abc', password: 'password' });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ApiException);
    const exception = error as ApiException;
    expect(exception.getStatus()).toBe(400);
    expect(exception.code).toBe('VALIDATION_FAILED');
    expect(exception.fieldErrors).toEqual([
      { field: 'username', key: 'validation:username.tooShort' },
      { field: 'password', key: 'validation:password.needsNumber' },
    ]);
  });

  it('keeps only the first error of a field', () => {
    let error: unknown;
    try {
      // Too short and invalid characters at the same time
      parseBody(signUpRequestSchema, { ...validBody, username: 'a b' });
    } catch (caught) {
      error = caught;
    }

    expect((error as ApiException).fieldErrors).toEqual([
      { field: 'username', key: 'validation:username.tooShort' },
    ]);
  });
});
