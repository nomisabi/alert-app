import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import '../i18n';

// Unmount rendered components after each test (needed because Vitest globals are off)
afterEach(() => {
  cleanup();
});
