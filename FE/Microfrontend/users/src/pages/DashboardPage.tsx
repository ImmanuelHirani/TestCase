import '../index.css';
import { ApiError, Card, Icon, LinearProgress } from '@jasindo/shared';
import type { User } from '@jasindo/shared';
import { useStatsQuery } from '../api/queries';
import { ErrorPanel } from '../components/ErrorPanel';

/**
 * Dashboard.
 *
 * Parent component: owns the query, and hands every child finished values as
 * props. react-query owns loading/error/caching now -- refetch on window
 * focus means a colleague's changes show up here without a manual reload,
 * and a 30s staleTime means bouncing dashboard -> users -> dashboard reuses
 * the figures instead of refetching every time.
 *
 * The figures come from one aggregate endpoint rather than from counting a
 * page of users on the client, so the numbers stay correct past page one.
 */
export function DashboardPage() {
  const { data: stats, isLoading: loading, error: queryError, refetch } = useStatsQuery();

  const error =
    queryError instanceof ApiError ? queryError : queryError ? new ApiError('SERVER_ERROR', 'Unexpected error.', 0) : null;

  if (error) {
    return (
      <section className="space-y-5">
        <PageHeader />
        <ErrorPanel error={error} onRetry={() => refetch()} />
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <PageHeader />

      <div className="grid gap-3 medium:grid-cols-2 large:grid-cols-4">
        <StatCard
          label="Total users"
          value={stats?.total_users}
          icon="group"
          loading={loading}
          tone="primary"
        />
        <StatCard
          label="Administrators"
          value={stats?.total_admins}
          icon="shield_person"
          loading={loading}
          tone="tertiary"
        />
        <StatCard
          label="Standard users"
          value={stats?.total_standard}
          icon="person"
          loading={loading}
          tone="secondary"
        />
        <StatCard
          label="Departments"
          value={stats?.total_departments}
          icon="apartment"
          loading={loading}
          tone="secondary"
        />
      </div>

      <div className="grid gap-3 expanded:grid-cols-2">
        <DepartmentBreakdown
          departments={stats?.by_department ?? []}
          total={stats?.total_users ?? 0}
          loading={loading}
        />
        <RecentUsers users={stats?.recent_users ?? []} loading={loading} />
      </div>
    </section>
  );
}

function PageHeader() {
  return (
    <header>
      <h1 className="md-headline-small text-on-surface">Dashboard</h1>
      <p className="md-body-medium mt-1 text-on-surface-variant">
        An overview of user accounts across the organisation.
      </p>
    </header>
  );
}

/*
 * Tone maps to an M3 accent group rather than to a raw colour. Primary is
 * reserved for the headline figure so it does not compete with the other
 * three for "most important thing here".
 */
const TONES = {
  primary: 'bg-primary-container text-on-primary-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  tertiary: 'bg-tertiary-container text-on-tertiary-container',
} as const;

function StatCard({
  label,
  value,
  icon,
  loading,
  tone,
}: {
  label: string;
  value: number | undefined;
  icon: string;
  loading: boolean;
  tone: keyof typeof TONES;
}) {
  return (
    <Card variant="filled" className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="md-label-large truncate text-on-surface-variant">{label}</p>
          {loading ? (
            <div className="mt-2 h-9 w-16 animate-pulse rounded-xs bg-on-surface/12" />
          ) : (
            <p className="md-display-small mt-1 text-on-surface tabular-nums">{value ?? 0}</p>
          )}
        </div>
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${TONES[tone]}`}
        >
          <Icon name={icon} size={24} filled />
        </span>
      </div>
    </Card>
  );
}

function DepartmentBreakdown({
  departments,
  total,
  loading,
}: {
  departments: { department: string; total: number }[];
  total: number;
  loading: boolean;
}) {
  // Bars are scaled against the largest department, not the headcount, so the
  // shape of the distribution stays readable when one team dominates.
  const largest = departments.reduce((max, d) => Math.max(max, d.total), 0);

  return (
    <Card variant="outlined" className="p-5">
      <h2 className="md-title-medium text-on-surface">By department</h2>
      <p className="md-body-small mt-1 text-on-surface-variant">
        {loading ? 'Loading…' : `${departments.length} departments · ${total} people`}
      </p>

      <ul className="mt-4 space-y-3">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="h-8 animate-pulse rounded-xs bg-on-surface/8" />
            ))
          : departments.map((d) => (
              <li key={d.department}>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="md-body-medium truncate text-on-surface">{d.department}</span>
                  <span className="md-label-medium shrink-0 text-on-surface-variant tabular-nums">
                    {d.total}
                  </span>
                </div>
                <LinearProgress value={d.total} max={largest} label={d.department} />
              </li>
            ))}
      </ul>
    </Card>
  );
}

function RecentUsers({ users, loading }: { users: User[]; loading: boolean }) {
  return (
    <Card variant="outlined" className="p-5">
      <h2 className="md-title-medium text-on-surface">Recently added</h2>
      <p className="md-body-small mt-1 text-on-surface-variant">The five newest accounts.</p>

      <ul className="mt-4 space-y-1">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="h-14 animate-pulse rounded-xs bg-on-surface/8" />
            ))
          : users.map((user) => (
              <li key={user.id} className="flex items-center gap-3 rounded-xs py-2">
                <span className="md-title-medium flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                  {initials(user.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="md-body-large truncate text-on-surface">{user.name}</p>
                  <p className="md-body-small truncate text-on-surface-variant">{user.email}</p>
                </div>
                <span
                  className={`md-label-small shrink-0 rounded-sm px-2 py-1 ${
                    user.role === 'admin'
                      ? 'bg-tertiary-container text-on-tertiary-container'
                      : 'bg-surface-container-highest text-on-surface-variant'
                  }`}
                >
                  {user.role}
                </span>
              </li>
            ))}
      </ul>
    </Card>
  );
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default DashboardPage;
