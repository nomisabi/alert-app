import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'src/generated', 'eslint.config.js']),
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: { ...globals.node, ...globals.vitest },
      // Type-aware linting: rules can use TypeScript's type information
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // A forgotten `await` is a classic backend bug, so these are errors
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      // Same project rule as the frontend: all date handling goes through date-fns (see CLAUDE.md)
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
          message: 'Use date-fns instead.',
        },
      ],
    },
  },
  // Must be last: turns off ESLint rules that conflict with Prettier formatting
  prettier,
]);
