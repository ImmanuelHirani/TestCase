import { Link } from 'react-router-dom';
import { Icon } from '@jasindo/shared';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <Icon name="explore_off" size={48} className="text-on-surface-variant" />
      <p className="md-display-small mt-4 text-on-surface-variant">404</p>
      <h1 className="md-headline-small mt-2 text-on-surface">Page not found</h1>
      <p className="md-body-medium mt-1 text-on-surface-variant">
        That route does not exist in the shell.
      </p>
      <Link
        to="/dashboard"
        className="md-state-layer md-label-large mt-8 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-6 text-on-primary [--md-state-color:var(--md-sys-color-on-primary)]"
      >
        <Icon name="arrow_back" size={20} />
        Back to dashboard
      </Link>
    </div>
  );
}

export default NotFoundPage;
