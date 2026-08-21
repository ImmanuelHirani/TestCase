/**
 * Module Federation resolves these at runtime, so TypeScript has no file to
 * look at. Declaring them here is what makes `import('users_mfe/UsersPage')`
 * type-check without disabling strictness.
 */
declare module 'users_mfe/DashboardPage' {
  const DashboardPage: React.ComponentType;
  export default DashboardPage;
}

declare module 'users_mfe/UsersPage' {
  const UsersPage: React.ComponentType;
  export default UsersPage;
}

declare module 'users_mfe/UserTable' {
  import type { User } from '@jasindo/shared';
  const UserTable: React.ComponentType<{
    users: User[];
    loading: boolean;
    canManage: boolean;
    restrictedFields: string[];
    sort: string;
    direction: 'asc' | 'desc';
    onSortChange: (sort: string, direction: 'asc' | 'desc') => void;
    onEdit: (user: User) => void;
    onDelete: (user: User) => void;
  }>;
  export default UserTable;
}

declare module 'auth_mfe/LoginPage' {
  import type { AuthUser } from '@jasindo/shared';
  const LoginPage: React.ComponentType<{ onSuccess?: (user: AuthUser) => void }>;
  export default LoginPage;
}
