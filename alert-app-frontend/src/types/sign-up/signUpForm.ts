import type { signUpFormSchema } from '@alert-app/shared';
import type { z } from 'zod';

export interface SignUpFormProps {
  /** Throws an ApiRequestError when the server rejects the sign-up. */
  onSubmit: (values: z.output<typeof signUpFormSchema>) => Promise<unknown>;
}
