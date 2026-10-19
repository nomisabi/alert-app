import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { getSession, isUsernameAvailable } from '../global/utils/authApi';
import '../i18n';

// No real requests in frontend tests: every auth call is a mock (vi.fn). The defaults below
// mean "logged out" and "username is free"; tests change them with vi.mocked(fn).mockResolvedValue(...).
vi.mock('../global/utils/authApi');

beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue(null);
  vi.mocked(isUsernameAvailable).mockResolvedValue({ available: true });
});

// Unmount rendered components after each test (needed because Vitest globals are off)
afterEach(() => {
  cleanup();
  // Forget calls and answers of the mocks, so tests don't affect each other
  vi.resetAllMocks();
});
