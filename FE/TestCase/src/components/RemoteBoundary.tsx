import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { Button, Icon } from '@jasindo/shared';

interface Props {
  /** Human name of the remote, used in the fallback copy. */
  name: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * The point of a microfrontend is that each remote deploys independently --
 * which means each remote can also *fail* independently. If the users remote
 * is down, its remoteEntry.js 404s and the dynamic import rejects; without
 * this boundary that reject unmounts the whole host and the user gets a white
 * screen instead of an app with one broken page.
 *
 * Wrap every federated mount in this.
 */
class RemoteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[host] remote "${this.props.name}" failed to mount`, error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="flex flex-col items-center rounded-md bg-tertiary-container px-6 py-16 text-center"
        >
          <Icon name="extension_off" size={48} className="text-on-tertiary-container" />
          <p className="md-title-medium mt-4 text-on-tertiary-container">
            The {this.props.name} module is unavailable
          </p>
          <p className="md-body-medium mt-1 max-w-md text-on-tertiary-container">
            This part of the app is served by its own microfrontend, which is not responding.
            The rest of the application is unaffected.
          </p>
          <p className="md-body-small mt-2 text-on-tertiary-container/70">
            {summarise(this.state.error)}
          </p>
          <Button
            variant="filled"
            icon="refresh"
            onClick={() => this.setState({ error: null })}
            className="mt-6 bg-tertiary text-on-tertiary [--md-state-color:var(--md-sys-color-on-tertiary)]"
          >
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

/** Boundary + Suspense in one, since a federated import always needs both. */
export function RemoteBoundary({ name, children }: Props) {
  return (
    <RemoteErrorBoundary name={name}>
      <Suspense fallback={<RemoteSkeleton name={name} />}>{children}</Suspense>
    </RemoteErrorBoundary>
  );
}

function RemoteSkeleton({ name }: { name: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label={`Loading ${name} module`}>
      <div className="h-9 w-48 animate-pulse rounded-sm bg-surface-container-highest" />
      <div className="h-64 animate-pulse rounded-md bg-surface-container-highest" />
    </div>
  );
}

/**
 * The Module Federation runtime error is several hundred characters of
 * internal remote names and doc links. Reduce it to the part that matters:
 * which URL could not be reached.
 */
function summarise(error: Error): string {
  const url = error.message.match(/https?:\/\/[^\s"'}]+remoteEntry\.js/)?.[0];
  return url ? `Could not load ${url}` : error.message;
}
