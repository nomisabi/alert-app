import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../errors/api.exception.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AdminUsersService, escapeLike } from './admin-users.service.js';

describe('escapeLike', () => {
  it('makes the SQL LIKE wildcards normal characters', () => {
    expect(escapeLike('a_b')).toBe('a\\_b');
    expect(escapeLike('100%')).toBe('100\\%');
    expect(escapeLike('back\\slash')).toBe('back\\\\slash');
  });

  it('leaves other text unchanged', () => {
    expect(escapeLike('anna.kovacs@example.com')).toBe('anna.kovacs@example.com');
  });
});

describe('AdminUsersService.update: an admin can not lock themselves out', () => {
  // The self checks run before any database access: a database call here would fail the test
  const prisma = {
    $transaction: () => Promise.reject(new Error('The database must not be used')),
  } as unknown as PrismaService;
  const service = new AdminUsersService(prisma);

  async function errorCode(promise: Promise<unknown>) {
    const error = await promise.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    return (error as ApiException).code;
  }

  it('rejects changing your own role', async () => {
    expect(await errorCode(service.update('me', 'me', { role: 'user' }))).toBe(
      'CANNOT_CHANGE_OWN_ROLE',
    );
  });

  it('rejects disabling yourself, even together with an allowed change', async () => {
    expect(await errorCode(service.update('me', 'me', { role: 'admin', disabled: true }))).toBe(
      'CANNOT_DISABLE_SELF',
    );
  });
});
