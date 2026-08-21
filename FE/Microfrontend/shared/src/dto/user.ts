import { z } from 'zod';

/**
 * DTOs for the user resource.
 *
 * Each schema is the single source of truth for one shape crossing the API
 * boundary in one direction: parsed at the boundary (catches backend drift
 * immediately, as a clear Zod error, instead of `undefined` reaching a
 * component), inferred into the TypeScript type (so the type can never
 * silently diverge from the runtime check), and reused as the
 * react-hook-form resolver for the matching form (so client-side validation
 * enforces exactly the rules the server will).
 */

export const RoleSchema = z.enum(['admin', 'user']);
export type Role = z.infer<typeof RoleSchema>;

/**
 * Response DTO -- matches UserResource on the Laravel side.
 *
 * `phone` is `.optional()` rather than merely `.nullable()`, and the
 * distinction is load-bearing: the server applies a per-viewer field policy
 * and *omits* restricted fields entirely rather than sending them as null
 * (Microsoft: "DO NOT send JSON fields with a null value from the service to
 * the client"). So the key can be legitimately absent, and a schema that
 * required it would reject every non-admin response.
 *
 *   phone: "0812..."  -> visible, has a value
 *   phone: null       -> visible, no value on file
 *   phone: undefined  -> withheld; see the response's field_policy for why
 *
 * Any field that becomes restrictable later has to be made optional here at
 * the same time -- that coupling is the point of keeping one schema.
 */
export const UserSchema = z.object({
  /**
   * The public identifier: a random v4 UUID, not the database's primary key.
   * The API never publishes the numeric key, so nothing on this side has a
   * type that could accidentally accept one -- `z.uuid()` here means a
   * response carrying a bare integer id fails validation loudly rather than
   * flowing through as a "valid" user.
   */
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  role: RoleSchema,
  department: z.string().nullable(),
  phone: z.string().nullable().optional(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});
export type User = z.infer<typeof UserSchema>;

/** Response DTO for the auth endpoints -- a narrower view of the same user. */
export const AuthUserSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  role: RoleSchema,
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

/**
 * Request DTO shared by create and update.
 *
 * This is the exact object react-hook-form validates live, field by field, as
 * the user types -- and the exact object sent as the request body. There is
 * only one place these rules are written.
 */
export const UserPayloadSchema = z.object({
  name: z.string().trim().min(3, 'Name must be at least 3 characters.').max(255),
  email: z.email('Enter a valid email address.').max(255),
  // Required on create; UserUpdatePayloadSchema below relaxes this to optional.
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(255),
  role: RoleSchema,
  department: z.string().max(255).optional().or(z.literal('')),
  phone: z
    .string()
    .max(30)
    .regex(/^[0-9+\-\s()]*$/, 'Phone may only contain digits, spaces, +, -, and parentheses.')
    .optional()
    .or(z.literal('')),
});
export type UserPayload = z.infer<typeof UserPayloadSchema>;

/**
 * Update relaxes password to optional-when-blank: on the wire an empty
 * string means "leave the current password alone", so it must be allowed to
 * be empty without failing the min-length rule that applies on create.
 */
export const UserUpdatePayloadSchema = UserPayloadSchema.extend({
  password: z
    .string()
    .max(255)
    .refine((value) => value === '' || value.length >= 8, {
      message: 'Password must be at least 8 characters.',
    }),
});
export type UserUpdatePayload = z.infer<typeof UserUpdatePayloadSchema>;
