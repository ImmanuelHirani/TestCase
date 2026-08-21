import type { UsersQuery } from './dto';

/**
 * Central query key registry.
 *
 * A typo in a query key is a cache bug that fails silently -- a mutation
 * invalidates ['uses'] while every list reads ['users'], and nothing ever
 * refetches. Building every key through one factory makes that typo a
 * TypeScript error instead of a runtime mystery.
 */
export const queryKeys = {
  session: () => ['session'] as const,
  stats: () => ['stats'] as const,
  users: {
    all: () => ['users'] as const,
    list: (query: UsersQuery) => ['users', 'list', query] as const,
    detail: (id: string) => ['users', 'detail', id] as const,
  },
};
