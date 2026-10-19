import type { loginSchema } from '@alert-app/shared';
import type { z } from 'zod';

export interface LoginFormProps {
  /** Throws an ApiRequestError when the server rejects the login. */
  onSubmit: (values: z.output<typeof loginSchema>) => Promise<unknown>;
}
