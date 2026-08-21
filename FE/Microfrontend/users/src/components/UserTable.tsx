import '../index.css';
import { useMemo } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { AnimatePresence, motion } from 'framer-motion';
import { Card, Icon, IconButton } from '@jasindo/shared';
import type { Role, User, UsersQuery } from '@jasindo/shared';

interface UserTableProps {
  users: User[];
  loading: boolean;
  canManage: boolean;
  /**
   * Field names the server withheld for this viewer, from the response's
   * field_policy. Columns for these render a lock rather than an empty cell,
   * so "not permitted" never gets mistaken for "no value on file".
   */
  restrictedFields: string[];
  sort: UsersQuery['sort'];
  direction: UsersQuery['direction'];
  onSortChange: (sort: UsersQuery['sort'], direction: UsersQuery['direction']) => void;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}

const columnHelper = createColumnHelper<User>();

/**
 * Responsive by structure, not by JS: an M3 data table from md up (built with
 * TanStack Table for column defs, sorting state, and row model), and a
 * stacked list of M3 list items below it that maps `users` directly -- a
 * table library adds nothing to a single-column card layout, so the mobile
 * view stays hand-rolled.
 *
 * Sorting is server-side (the backend does the ORDER BY): this table is in
 * `manualSorting` mode, meaning it never reorders rows itself. Clicking a
 * header just reports "sort by this column" up to the parent, which encodes
 * it into the URL and lets the query key change trigger a refetch.
 */
export function UserTable({
  users,
  loading,
  canManage,
  restrictedFields,
  sort,
  direction,
  onSortChange,
  onEdit,
  onDelete,
}: UserTableProps) {
  // An empty array means "no explicit sort" -- the server then applies its
  // own default ordering, and no header renders as active.
  const sorting: SortingState = useMemo(
    () => (sort ? [{ id: sort, desc: direction === 'desc' }] : []),
    [sort, direction],
  );
  const isRestricted = (field: string) => restrictedFields.includes(field);

  const columns = useMemo(
    () => [
      columnHelper.accessor('id', {
        header: 'ID',
        // Not sortable: the value is a random uuid, so an ordering by it
        // would look arbitrary to anyone reading the column. The backend
        // rejects 'id' as a sort key for the same reason.
        enableSorting: false,
        // The id is the server's public UUID -- the database's primary key is
        // never sent to the browser. All 36 characters would swamp the column
        // and none of them mean anything to a human, so only the first block
        // is shown; the full value is on the title attribute for copying, and
        // the search box prefix-matches on exactly this visible fragment.
        cell: (info) => (
          <span
            className="md-body-small font-mono text-on-surface-variant"
            title={info.getValue()}
          >
            {info.getValue().slice(0, 8)}
          </span>
        ),
      }),
      columnHelper.accessor('name', {
        header: 'Name',
        cell: (info) => <span className="md-body-medium text-on-surface">{info.getValue()}</span>,
      }),
      columnHelper.accessor('email', {
        header: 'Email',
        cell: (info) => <span className="md-body-medium text-on-surface-variant">{info.getValue()}</span>,
      }),
      columnHelper.accessor('department', {
        header: 'Department',
        enableSorting: true,
        cell: (info) => (
          <span className="md-body-medium text-on-surface-variant">{info.getValue() ?? '—'}</span>
        ),
      }),
      columnHelper.accessor('role', {
        header: 'Role',
        cell: (info) => <RoleBadge role={info.getValue()} />,
      }),
      columnHelper.display({
        id: 'phone',
        header: 'Phone',
        enableSorting: false,
        cell: (info) =>
          isRestricted('phone') ? (
            <RestrictedCell />
          ) : (
            <span className="md-body-medium text-on-surface-variant">
              {info.row.original.phone ?? '—'}
            </span>
          ),
      }),
      columnHelper.display({
        id: 'actions',
        header: () => <span className="block text-right">Actions</span>,
        enableSorting: false,
        cell: (info) =>
          canManage && (
            <div className="flex justify-end gap-1">
              <IconButton icon="edit" label={`Edit ${info.row.original.name}`} onClick={() => onEdit(info.row.original)} />
              <IconButton
                icon="delete"
                label={`Delete ${info.row.original.name}`}
                onClick={() => onDelete(info.row.original)}
                className="text-error [--md-state-color:var(--md-sys-color-error)]"
              />
            </div>
          ),
      }),
    ],
    // restrictedFields is joined rather than passed by reference: it is a
    // fresh array on every response, so the reference always differs even
    // when the contents are identical, and the columns would rebuild on
    // every fetch for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, onEdit, onDelete, restrictedFields.join(',')],
  );

  const table = useReactTable({
    data: users,
    columns: canManage ? columns : columns.filter((c) => c.id !== 'actions'),
    state: { sorting },
    manualSorting: true,
    enableMultiSort: false,
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      const [first] = next;
      // Clicking a sorted header a third time clears it, which is a real
      // state: it hands ordering back to the server's default rather than
      // silently keeping the previous column.
      if (!first) {
        onSortChange(undefined, 'asc');
        return;
      }
      // Safe: every sortable column id here is one of the accessor keys
      // below, which is exactly the sortable subset of UsersQuery['sort'].
      // 'id' and 'actions' both disable sorting, so neither reaches this.
      onSortChange(first.id as UsersQuery['sort'], first.desc ? 'desc' : 'asc');
    },
    getCoreRowModel: getCoreRowModel(),
  });

  if (loading) {
    return <TableSkeleton />;
  }

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-md border border-dashed border-outline-variant px-6 py-16 text-center">
        <Icon name="person_search" size={48} className="text-on-surface-variant" />
        <p className="md-title-medium mt-4 text-on-surface">No users found</p>
        <p className="md-body-medium mt-1 text-on-surface-variant">
          Try a different search term or clear the role filter.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop / tablet — M3 data table */}
      <Card variant="outlined" className="hidden overflow-hidden expanded:block">
        <table className="w-full text-left">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-outline-variant">
                {headerGroup.headers.map((header) => (
                  <Th
                    key={header.id}
                    align={header.column.id === 'actions' ? 'right' : 'left'}
                    sortable={header.column.getCanSort()}
                    sortDirection={header.column.getIsSorted()}
                    onSort={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </Th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {table.getRowModel().rows.map((row) => (
                <motion.tr
                  key={row.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-b border-outline-variant last:border-0 hover:bg-on-surface/8"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </Card>

      {/* Mobile — M3 list items in a card */}
      <ul className="space-y-2 expanded:hidden">
        <AnimatePresence initial={false}>
          {users.map((user) => (
            <motion.li
              key={user.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card variant="filled" className="p-4">
                <div className="flex items-start gap-3">
                  {/* M3 list avatar: primary-container circle with initials */}
                  <span className="md-title-medium flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                    {initials(user.name)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="md-body-large truncate text-on-surface">{user.name}</p>
                    <p className="md-body-medium truncate text-on-surface-variant">{user.email}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <RoleBadge role={user.role} />
                      <span className="md-body-small text-on-surface-variant" title={user.id}>
                        <span className="font-mono">{user.id.slice(0, 8)}</span> ·{' '}
                        {user.department ?? '—'}
                      </span>
                      {isRestricted('phone') ? (
                        <RestrictedCell />
                      ) : (
                        user.phone && (
                          <span className="md-body-small text-on-surface-variant">{user.phone}</span>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {canManage && (
                  <div className="mt-3 flex justify-end gap-1 border-t border-outline-variant pt-3">
                    <IconButton icon="edit" label={`Edit ${user.name}`} onClick={() => onEdit(user)} />
                    <IconButton
                      icon="delete"
                      label={`Delete ${user.name}`}
                      onClick={() => onDelete(user)}
                      className="text-error [--md-state-color:var(--md-sys-color-error)]"
                    />
                  </div>
                )}
              </Card>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </>
  );
}

function Th({
  children,
  align = 'left',
  sortable,
  sortDirection,
  onSort,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  sortable: boolean;
  sortDirection: false | 'asc' | 'desc';
  onSort?: (event: unknown) => void;
}) {
  if (!sortable) {
    return (
      <th
        scope="col"
        className={`md-title-small px-4 py-3 text-on-surface ${align === 'right' ? 'text-right' : ''}`}
      >
        {children}
      </th>
    );
  }

  return (
    <th scope="col" className="p-0">
      <button
        type="button"
        onClick={onSort}
        className={[
          'md-state-layer md-title-small flex h-full w-full items-center gap-1 px-4 py-3 text-on-surface',
          '[--md-state-color:var(--md-sys-color-on-surface)]',
          align === 'right' ? 'justify-end' : 'justify-start',
        ].join(' ')}
      >
        {align === 'right' && sortDirection && <SortIcon direction={sortDirection} />}
        {children}
        {align !== 'right' && (sortDirection ? <SortIcon direction={sortDirection} /> : <SortIcon direction={false} />)}
      </button>
    </th>
  );
}

function SortIcon({ direction }: { direction: false | 'asc' | 'desc' }) {
  return (
    <Icon
      name={direction === 'desc' ? 'arrow_downward' : 'arrow_upward'}
      size={18}
      className={direction ? 'text-primary' : 'text-on-surface-variant/40'}
    />
  );
}

/**
 * Admin uses tertiary, not primary. M3 reserves primary for the main action in
 * the view -- reusing it for a badge would compete with the FAB and the
 * filled button for the same "most important thing here" signal.
 */
/**
 * A field the server withheld for this viewer. Deliberately distinct from an
 * empty value: the API omits restricted fields entirely rather than sending
 * null, so without this the cell would be indistinguishable from a user who
 * simply has no phone number recorded.
 */
function RestrictedCell() {
  return (
    <span
      className="md-body-small inline-flex items-center gap-1 text-on-surface-variant/60"
      title="Hidden for your role. Sign in as an admin to view."
    >
      <Icon name="lock" size={18} />
      restricted
    </span>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const style =
    role === 'admin'
      ? 'bg-tertiary-container text-on-tertiary-container'
      : 'bg-surface-container-highest text-on-surface-variant';

  return (
    <span className={`md-label-small inline-flex shrink-0 rounded-sm px-2 py-1 ${style}`}>
      {role}
    </span>
  );
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function TableSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading users">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-md bg-surface-container-highest" />
      ))}
    </div>
  );
}
