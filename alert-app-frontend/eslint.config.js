import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'src/api/generated']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Project rule: all date handling goes through date-fns (see CLAUDE.md)
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'moment', message: 'Use date-fns instead.' },
            { name: 'dayjs', message: 'Use date-fns instead.' },
            { name: 'luxon', message: 'Use date-fns instead.' },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression[callee.property.name=/^(toLocaleDateString|toLocaleTimeString)$/]',
          message: 'Use formatDate() from src/global/utils/date (date-fns) instead.',
        },
      ],
    },
  },
  // Must be last: turns off ESLint rules that conflict with Prettier formatting
  prettier,
]);
