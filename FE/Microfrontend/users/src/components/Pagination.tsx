import { Button, Icon, IconButton } from '@jasindo/shared';
import type { CursorPage } from '@jasindo/shared';

interface PaginationProps {
  page: CursorPage;
  /** How many rows are actually on screen, for the "showing N" readout. */
  rowCount: number;
  /** True once the user has paged forward at least once. */
  canGoBack: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onFirst: () => void;
  onLimitChange: (limit: number) => void;
}

const LIMIT_OPTIONS = [10, 25, 50];

/**
 * Cursor pagination controls.
 *
 * Deliberately prev/next/first rather than numbered pages: a cursor points at
 * "the row after this specific one", which is what makes it immune to rows
 * being inserted or deleted mid-browse -- but it also means there is no
 * page 7 to jump to, and no total to count against. That trade is the whole
 * reason for using cursors (see the backend's UserRepository), so the UI
 * states it plainly instead of faking page numbers on top.
 */
export function Pagination({
  page,
  rowCount,
  canGoBack,
  onNext,
  onPrevious,
  onFirst,
  onLimitChange,
}: PaginationProps) {
  return (
    <div className="flex flex-col gap-3 border-t border-outline-variant pt-4 medium:flex-row medium:items-center medium:justify-between">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <span className="md-body-small text-on-surface-variant">Rows per page</span>
          <select
            value={page.limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="md-body-medium rounded-xs border border-outline bg-transparent px-2 py-1 text-on-surface outline-none focus-visible:border-primary"
          >
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <span className="md-body-small text-on-surface-variant tabular-nums">
          {rowCount === 0 ? 'No results' : `Showing ${rowCount}`}
        </span>

        {/* Why there is no "of N" here, surfaced rather than left as a gap. */}
        <span
          className="md-body-small inline-flex items-center gap-1 text-on-surface-variant/70"
          title="Cursor pagination does not carry a total count: producing one costs a second full table scan. The dashboard's totals come from /stats instead."
        >
          <Icon name="info" size={18} />
          cursor paging
        </span>
      </div>

      <nav className="flex flex-wrap items-center gap-1" aria-label="Pagination">
        <span className="hidden medium:inline-flex">
          <IconButton icon="first_page" label="First page" disabled={!canGoBack} onClick={onFirst} />
        </span>

        <Button
          variant="outlined"
          icon="chevron_left"
          disabled={!canGoBack}
          onClick={onPrevious}
        >
          Previous
        </Button>

        <Button variant="outlined" disabled={!page.has_more} onClick={onNext}>
          Next
        </Button>
      </nav>
    </div>
  );
}
