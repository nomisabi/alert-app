// Public API of @alert-app/shared. Everything the apps import is exported here.
//   constants/  fixed values (limits, lists)
//   schemas/    Zod schemas (validation rules) and the types inferred from them
//   types/      TypeScript types without a schema
//   i18n/       texts used by both apps (e.g. validation messages)
export * from './constants/auth.js';
export * from './constants/categories.js';
export * from './i18n/validation.en.js';
export * from './schemas/auth.js';
export * from './schemas/categories.js';
export * from './types/api-error.js';
export * from './types/auth.js';
