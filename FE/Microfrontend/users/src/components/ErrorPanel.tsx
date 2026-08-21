import { ApiError, Button, Icon } from '@jasindo/shared';

interface ErrorPanelProps {
  error: ApiError;
  onRetry?: () => void;
}

/**
 * The brief asks for API errors to be shown in the component, not swallowed.
 * Every failed fetch lands here with the server's own message.
 */
export function ErrorPanel({ error, onRetry }: ErrorPanelProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-md bg-error-container px-6 py-12 text-center"
    >
      <Icon name={iconFor(error)} size={48} className="text-on-error-container" />
      <p className="md-title-medium mt-4 text-on-error-container">{titleFor(error)}</p>
      <p className="md-body-medium mt-1 max-w-md text-on-error-container">{error.message}</p>
      <p className="md-body-small mt-2 text-on-error-container/70">
        {error.code}
        {error.status > 0 && ` · HTTP ${error.status}`}
      </p>
      {onRetry && (
        <Button
          variant="filled"
          icon="refresh"
          onClick={onRetry}
          className="mt-6 bg-error text-on-error [--md-state-color:var(--md-sys-color-on-error)]"
        >
          Retry
        </Button>
      )}
    </div>
  );
}

function iconFor(error: ApiError): string {
  switch (error.code) {
    case 'NETWORK_ERROR':
      return 'cloud_off';
    case 'FORBIDDEN':
      return 'lock';
    case 'UNAUTHENTICATED':
      return 'person_off';
    case 'NOT_FOUND':
      return 'search_off';
    case 'TOO_MANY_REQUESTS':
      return 'hourglass_top';
    default:
      return 'error';
  }
}

function titleFor(error: ApiError): string {
  switch (error.code) {
    case 'NETWORK_ERROR':
      return 'Cannot reach the server';
    case 'FORBIDDEN':
      return 'You do not have access to this';
    case 'UNAUTHENTICATED':
      return 'Your session has expired';
    case 'NOT_FOUND':
      return 'Not found';
    case 'TOO_MANY_REQUESTS':
      return 'Too many requests';
    default:
      return 'Something went wrong';
  }
}
