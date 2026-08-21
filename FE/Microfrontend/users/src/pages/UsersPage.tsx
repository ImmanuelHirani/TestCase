import '../index.css';
import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ApiError, Icon, Snackbar, UsersQuerySchema, useSession } from '@jasindo/shared';
import type { User, UserPayload, UsersQuery } from '@jasindo/shared';
import {
  loadUserForEditing,
  useCreateUserMutation,
  useDeleteUserMutation,
  useUpdateUserMutation,
  useUsersQuery,
} from '../api/queries';
import { useDebounce } from '../hooks/useDebounce';
import { ErrorPanel } from '../components/ErrorPanel';
import { UserToolbar } from '../components/UserToolbar';
import { UserTable } from '../components/UserTable';
import { Pagination } from '../components/Pagination';
import { UserFormModal } from '../components/UserFormModal';
import { ConfirmDialog } from '../components/ConfirmDialog';

/**
 * Parent component.
 *
 * The list's state (search, role filter, cursor, sort) lives in component
 * state and travels to the API in a POST body -- deliberately *not* in the
 * URL. Two reasons, one of them a real trade:
 *
 *   - The browser URL stays `/users`, and the request URL stays
 *     `POST /api/v1/users:search`, with nothing appended. Filter values never
 *     land in browser history, an access log, or a `Referer` header on an
 *     outbound link. When the filter is an employee's name, that is a privacy
 *     property rather than a cosmetic one.
 *   - The cost, stated plainly: a filtered view is no longer shareable as a
 *     link, and the back button does not step through filter changes. For an
 *     authenticated internal dashboard that is an acceptable trade; for a
 *     public catalogue it would not be, and the filters would belong in the
 *     URL instead.
 *
 * The query object still keys the react-query cache, so caching, refetching
 * and `keepPreviousData` behave exactly as they did when it lived in the URL.
 *
 * Everything below UsersPage stays presentational: each child receives what
 * it renders as props and reports changes back through a callback. That
 * one-way flow is what the brief asks for when it says props must travel
 * from the parent component to its children -- moving where the state lives
 * changed nothing about how it flows down.
 */
export function UsersPage() {
  const [query, setQuery] = useState<UsersQuery>(() => UsersQuerySchema.parse({}));

  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);

  const [editing, setEditing] = useState<User | null | undefined>(undefined);
  // The ETag of whatever `editing` currently holds, fetched fresh right
  // before the dialog opens (see loadEditTarget) -- never copied off a
  // cached list row, since the list response carries no per-row ETag at all.
  const [editingETag, setEditingETag] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [formError, setFormError] = useState<ApiError | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { isAdmin: canManage } = useSession();

  const usersQuery = useUsersQuery(query);
  const createMutation = useCreateUserMutation();
  // Empty string when no row is being edited -- the hook has to be called
  // unconditionally, but the mutation is only ever fired from the dialog,
  // which cannot be open without an `editing` row.
  const updateMutation = useUpdateUserMutation(editing?.id ?? '');
  const deleteMutation = useDeleteUserMutation();

  /** Merge a partial change into the query that keys the cache and forms the request body. */
  function updateQuery(partial: Partial<UsersQuery>) {
    setQuery((current) => ({ ...current, ...partial }));
  }

  // Debounced search commits to the query -- and drops the cursor, because a
  // cursor is only meaningful within the result set that produced it. Keeping
  // it across a filter change would resume from a row that may no longer be
  // in the new set at all.
  useEffect(() => {
    if (debouncedSearch !== (query.search ?? '')) {
      updateQuery({ search: debouncedSearch || undefined, cursor: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const closeEditor = () => {
    setEditing(undefined);
    setEditingETag(null);
  };

  const error =
    usersQuery.error instanceof ApiError
      ? usersQuery.error
      : usersQuery.isError
        ? new ApiError('SERVER_ERROR', 'Unexpected error.', 0)
        : null;

  // Fetches the row fresh -- with its current ETag -- right before the edit
  // dialog opens, rather than editing off whatever was sitting in the table.
  // That covers two things at once: the list could be stale (someone else's
  // change hasn't reached this client's cache yet), and the list response
  // never carried an ETag to send back as If-Match in the first place.
  const loadEditTarget = async (user: User) => {
    setFormError(null);
    try {
      const fresh = await loadUserForEditing(user.id);
      setEditingETag(fresh.etag);
      setEditing(fresh.user);
    } catch (err) {
      setToast(
        err instanceof ApiError
          ? `Couldn't open ${user.name} for editing: ${err.message}`
          : `Couldn't open ${user.name} for editing.`,
      );
    }
  };

  const handleSave = (payload: UserPayload) => {
    setFormError(null);

    if (editing) {
      updateMutation.mutate(
        { payload, etag: editingETag },
        {
          onSuccess: () => {
            setToast('User updated.');
            closeEditor();
          },
          onError: (err) => {
            setFormError(err instanceof ApiError ? err : new ApiError('SERVER_ERROR', 'Unexpected error.', 0));
          },
        },
      );
      return;
    }

    createMutation.mutate(payload, {
      onSuccess: () => {
        setToast('User created.');
        closeEditor();
      },
      onError: (err) => {
        setFormError(err instanceof ApiError ? err : new ApiError('SERVER_ERROR', 'Unexpected error.', 0));
      },
    });
  };

  const handleDelete = () => {
    if (!deleting) return;
    const name = deleting.name;

    deleteMutation.mutate(deleting.id, {
      onSuccess: () => {
        setDeleting(null);
        setToast(`${name} was deleted.`);
      },
      onError: () => {
        setDeleting(null);
      },
    });
  };

  return (
    <section className="space-y-5">
      <header>
        <h1 className="md-headline-small text-on-surface">Users</h1>
        <p className="md-body-medium mt-1 text-on-surface-variant">
          {canManage
            ? 'Search, filter and manage user accounts.'
            : 'Search and browse user accounts. Editing requires an admin account.'}
        </p>
      </header>

      <UserToolbar
        search={searchInput}
        role={query.role ?? ''}
        canCreate={canManage}
        onSearchChange={setSearchInput}
        onRoleChange={(role) => updateQuery({ role: role || undefined, cursor: undefined })}
        onCreate={() => {
          setFormError(null);
          setEditingETag(null);
          setEditing(null);
        }}
      />

      {error ? (
        <ErrorPanel error={error} onRetry={() => usersQuery.refetch()} />
      ) : (
        <>
          {/* The server's field policy, surfaced rather than left implicit: a
              missing column should read as "you may not see this", never as
              "this record happens to be blank". */}
          {usersQuery.data && usersQuery.data.field_policy.restricted.length > 0 && (
            <div className="flex items-start gap-3 rounded-xs bg-surface-container-high px-4 py-3">
              <Icon name="lock" size={20} className="mt-0.5 shrink-0 text-on-surface-variant" />
              <p className="md-body-small text-on-surface-variant">
                Some fields are hidden for your role (
                <span className="font-medium">{usersQuery.data.field_policy.viewer_role}</span>):{' '}
                <span className="font-medium">
                  {usersQuery.data.field_policy.restricted.join(', ')}
                </span>
                . {usersQuery.data.field_policy.note}
              </p>
            </div>
          )}

          <UserTable
            users={usersQuery.data?.data ?? []}
            loading={usersQuery.isLoading}
            canManage={canManage}
            restrictedFields={usersQuery.data?.field_policy.restricted ?? []}
            sort={query.sort}
            direction={query.direction}
            onSortChange={(sort, direction) => updateQuery({ sort, direction, cursor: undefined })}
            onEdit={loadEditTarget}
            onDelete={setDeleting}
          />

          {usersQuery.data && (
            <Pagination
              page={usersQuery.data.page}
              rowCount={usersQuery.data.data.length}
              canGoBack={Boolean(query.cursor)}
              onNext={() => updateQuery({ cursor: usersQuery.data.page.next_cursor ?? undefined })}
              onPrevious={() =>
                updateQuery({ cursor: usersQuery.data.page.prev_cursor ?? undefined })
              }
              onFirst={() => updateQuery({ cursor: undefined })}
              onLimitChange={(limit) => updateQuery({ limit, cursor: undefined })}
            />
          )}
        </>
      )}

      {editing !== undefined && (
        <UserFormModal
          user={editing}
          submitting={createMutation.isPending || updateMutation.isPending}
          error={formError}
          onSubmit={handleSave}
          onCancel={closeEditor}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete user"
          message={`Delete ${deleting.name} (${deleting.email})? This cannot be undone.`}
          busy={deleteMutation.isPending}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      <AnimatePresence>
        {toast && (
          <Snackbar
            key={toast}
            message={toast}
            action="Dismiss"
            onAction={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

export default UsersPage;
