// Makes t() type-safe: unknown translation keys are compile errors.
import 'i18next';
import type { defaultNS, resources } from './index';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: (typeof resources)['en'];
  }
}
