import { z } from 'zod';

/**
 * Cursor page metadata.
 *
 * No `total` and no page numbers, on purpose -- see the backend's
 * UserRepository::cursorPaginate for why (a total costs a second full scan,
 * and offset paging skips/duplicates rows when the data changes underneath
 * a reader). The UI trades "jump to page 7" for correctness and flat cost.
 */
export const CursorPageSchema = z.object({
  limit: z.number().int().positive(),
  has_more: z.boolean(),
  /**
   * Opaque by contract. Hand these back verbatim -- never parse, decode or
   * construct one; the encoding is the server's to change.
   */
  next_cursor: z.string().nullable(),
  prev_cursor: z.string().nullable(),
});
export type CursorPage = z.infer<typeof CursorPageSchema>;

/**
 * The server's per-viewer field policy, published alongside the data so a
 * missing field is unambiguous: "you may not see this" rather than "this
 * record has no value". Rendered in the UI as a lock hint rather than a
 * blank cell.
 */
export const FieldPolicySchema = z.object({
  viewer_role: z.string(),
  visible: z.array(z.string()),
  restricted: z.array(z.string()),
  note: z.string(),
});
export type FieldPolicy = z.infer<typeof FieldPolicySchema>;

/**
 * A cursor-paginated collection response for any item schema.
 *
 * `operation` echoes which custom method produced the page (`find` vs
 * `search`), which is what makes a Network trace self-describing.
 */
export function cursorPaginatedSchema<T extends z.ZodType>(item: T) {
  return z.object({
    operation: z.string(),
    data: z.array(item),
    page: CursorPageSchema,
    field_policy: FieldPolicySchema,
  });
}

export type CursorPaginated<T> = {
  operation: string;
  data: T[];
  page: CursorPage;
  field_policy: FieldPolicy;
};
