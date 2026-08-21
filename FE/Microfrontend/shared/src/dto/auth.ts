import { z } from 'zod';
import { AuthUserSchema } from './user';

/**
 * Request DTO for POST /login. Reused directly as the login form's
 * react-hook-form resolver, so the field-level rules the user sees while
 * typing are the exact rules the request body must satisfy.
 */
export const LoginPayloadSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});
export type LoginPayload = z.infer<typeof LoginPayloadSchema>;

/**
 * Response DTO for /login and /me.
 *
 * No token field: the JWT itself never appears in a JSON body the frontend
 * can read -- it only ever exists as the HttpOnly `jasindo_token` cookie the
 * browser attaches automatically. `expires_at` lets the UI plan around
 * expiry (e.g. re-check the session) without needing to decode a cookie it
 * has no access to.
 */
export const AuthResponseSchema = z.object({
  success: z.literal(true),
  user: AuthUserSchema,
  expires_at: z.iso.datetime({ offset: true }),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
