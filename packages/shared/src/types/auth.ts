import type { Role } from '../schemas/auth.js';

/** The logged-in user, as returned by GET /api/auth/get-session. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  username: string;
  displayUsername: string;
  role: Role;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
