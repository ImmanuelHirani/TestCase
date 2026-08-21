import { Button, FilterChip, Icon, TextField } from '@jasindo/shared';
import type { Role } from '@jasindo/shared';

interface UserToolbarProps {
  search: string;
  role: Role | '';
  canCreate: boolean;
  onSearchChange: (value: string) => void;
  onRoleChange: (value: Role | '') => void;
  onCreate: () => void;
}

/**
 * Child component: holds no state of its own, everything arrives as props
 * from UsersPage and every change is reported back through a callback.
 *
 * The role filter uses M3 filter chips rather than a select -- with only three
 * options, chips show the current state without a click.
 */
export function UserToolbar({
  search,
  role,
  canCreate,
  onSearchChange,
  onRoleChange,
  onCreate,
}: UserToolbarProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 medium:flex-row medium:items-start">
        <div className="flex-1 medium:max-w-sm">
          <TextField
            label="Search"
            type="search"
            value={search}
            leadingIcon="search"
            supportingText="By name, email, or ID"
            onChange={(e) => onSearchChange(e.target.value)}
            trailingIcon={
              search ? (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="Clear search"
                  className="md-state-layer -mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant [--md-state-color:var(--md-sys-color-on-surface-variant)]"
                >
                  <Icon name="close" size={20} />
                </button>
              ) : undefined
            }
          />
        </div>

        {canCreate && (
          <Button variant="filled" icon="add" onClick={onCreate} className="medium:mt-2">
            Add user
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="md-label-large mr-1 text-on-surface-variant">Role</span>
        <FilterChip label="All" selected={role === ''} onClick={() => onRoleChange('')} />
        <FilterChip label="Admin" selected={role === 'admin'} onClick={() => onRoleChange('admin')} />
        <FilterChip label="User" selected={role === 'user'} onClick={() => onRoleChange('user')} />
      </div>
    </div>
  );
}
