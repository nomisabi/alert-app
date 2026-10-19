import { describe, expect, it } from 'vitest';
import { USER_SEARCH_MAX_LENGTH } from '../constants/admin-users.js';
import { MAX_PAGE_SIZE } from '../constants/pagination.js';
import { validationMessagesEn } from '../i18n/validation.en.js';
import { adminUserListQuerySchema, updateAdminUserRequestSchema } from './admin-users.js';

describe('adminUserListQuerySchema', () => {
  it('uses the defaults when nothing is given', () => {
    expect(adminUserListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it('turns query texts into numbers and trims the search', () => {
    expect(
      adminUserListQuerySchema.parse({ page: '2', pageSize: '50', search: '  anna ' }),
    ).toEqual({ page: 2, pageSize: 50, search: 'anna' });
  });

  it('rejects invalid page values', () => {
    for (const query of [
      { page: 'x' },
      { page: '0' },
      { page: '1.5' },
      { pageSize: String(MAX_PAGE_SIZE + 1) },
    ]) {
      const result = adminUserListQuerySchema.safeParse(query);
      expect(result.error?.issues[0]?.message).toBe('invalid');
    }
  });

  it('rejects a too long search with a key that has a text', () => {
    const result = adminUserListQuerySchema.safeParse({
      search: 'a'.repeat(USER_SEARCH_MAX_LENGTH + 1),
    });

    expect(result.error?.issues[0]?.message).toBe('search.tooLong');
    expect(validationMessagesEn.search.tooLong).toBeTruthy();
  });
});

describe('updateAdminUserRequestSchema', () => {
  it('accepts any combination of the fields, including none', () => {
    for (const body of [
      {},
      { role: 'admin' },
      { disabled: true },
      { role: 'user', disabled: false },
    ]) {
      expect(updateAdminUserRequestSchema.safeParse(body).success).toBe(true);
    }
  });

  it('rejects unknown roles and non-boolean disabled', () => {
    expect(updateAdminUserRequestSchema.safeParse({ role: 'superadmin' }).success).toBe(false);
    expect(updateAdminUserRequestSchema.safeParse({ disabled: 'yes' }).success).toBe(false);
  });

  it('drops fields that are not allowed to change', () => {
    expect(updateAdminUserRequestSchema.parse({ disabled: true, email: 'x@example.com' })).toEqual({
      disabled: true,
    });
  });
});
