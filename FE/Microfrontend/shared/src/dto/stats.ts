import { z } from 'zod';
import { UserSchema } from './user';

export const DepartmentCountSchema = z.object({
  department: z.string(),
  total: z.number().int().nonnegative(),
});
export type DepartmentCount = z.infer<typeof DepartmentCountSchema>;

/** Response DTO for GET /stats. */
export const StatsSchema = z.object({
  total_users: z.number().int().nonnegative(),
  total_admins: z.number().int().nonnegative(),
  total_standard: z.number().int().nonnegative(),
  total_departments: z.number().int().nonnegative(),
  added_last_7_days: z.number().int().nonnegative(),
  by_department: z.array(DepartmentCountSchema),
  recent_users: z.array(UserSchema),
});
export type Stats = z.infer<typeof StatsSchema>;
