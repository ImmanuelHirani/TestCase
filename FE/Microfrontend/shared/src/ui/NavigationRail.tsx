import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { IconButton } from './Button';

export interface NavDestination {
  to: string;
  label: string;
  icon: string;
  /** Optional count shown as an M3 badge on the destination. */
  badge?: number;
}

/**
 * Render prop so the rail stays router-agnostic: the host owns routing, the
 * rail only knows "is this destination active" and "render a link".
 */
export interface NavLinkRenderProps {
  to: string;
  className: string;
  children: ReactNode;
  onClick?: () => void;
}

interface NavigationRailProps {
  destinations: NavDestination[];
  isActive: (to: string) => boolean;
  renderLink: (props: NavLinkRenderProps) => ReactNode;
  expanded: boolean;
  onToggle: () => void;
  /** Primary action anchored to the top of the rail, above the destinations. */
  fab?: { label: string; icon: string; onClick: () => void };
  /**
   * Rendered under the destinations — account switcher, sign-out, etc.
   *
   * A render function, not a node: the same shell renders both a collapsed
   * rail and an always-expanded modal rail at the same time, so the footer has
   * to follow whichever rail is drawing it rather than the shell's own state.
   */
  footer?: (expanded: boolean) => ReactNode;
  onNavigate?: () => void;
}

/**
 * M3 navigation rail.
 *
 * In M3 Expressive the navigation *drawer* is deprecated: a persistent sidebar
 * is now the expanded navigation rail in its standard configuration. Collapsed
 * and expanded are the same component, so toggling between them is a width
 * change rather than a swap to a different navigation element.
 *
 * Spec points this implements:
 *   - leading edge of the window, outside any content pane
 *   - menu button and FAB are always top-aligned, in that order
 *   - active indicator is secondary-container and marks exactly one item
 *   - in the expanded rail the indicator fills the container, which the spec
 *     endorses for "a similar style to the baseline navigation drawer" -- the
 *     admin-dashboard look
 *   - the target area spans the full rail width even when the indicator hugs
 *   - the selected icon becomes filled, not merely recoloured
 *   - destinations stay fixed while body content scrolls
 */
export function NavigationRail({
  destinations,
  isActive,
  renderLink,
  expanded,
  onToggle,
  fab,
  footer,
  onNavigate,
}: NavigationRailProps) {
  return (
    <nav
      aria-label="Main navigation"
      className={[
        'flex h-full flex-col gap-1 bg-surface-container py-3',
        'transition-[width] duration-300 ease-emphasized',
        expanded ? 'w-70 px-3' : 'w-24 px-2',
      ].join(' ')}
    >
      {/* Menu — top-aligned, and its icon reflects what the next press does. */}
      <div className={expanded ? 'px-1' : 'flex justify-center'}>
        <IconButton
          icon={expanded ? 'menu_open' : 'menu'}
          label={expanded ? 'Collapse navigation' : 'Expand navigation'}
          onClick={onToggle}
        />
      </div>

      {/* FAB — above the destinations, never below them. Nested in the rail,
          so its resting elevation is level 0. */}
      {fab && (
        <div className={`mt-2 mb-3 ${expanded ? 'px-1' : 'flex justify-center'}`}>
          <button
            type="button"
            onClick={fab.onClick}
            aria-label={fab.label}
            className={[
              'md-state-layer md-label-large flex h-14 items-center gap-3 rounded-lg',
              'bg-primary-container text-on-primary-container',
              '[--md-state-color:var(--md-sys-color-on-primary-container)]',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              expanded ? 'w-full px-4' : 'w-14 justify-center',
            ].join(' ')}
          >
            <Icon name={fab.icon} size={24} />
            {expanded && <span>{fab.label}</span>}
          </button>
        </div>
      )}

      <ul className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {destinations.map((destination) => (
          <li key={destination.to}>
            <RailItem
              destination={destination}
              active={isActive(destination.to)}
              expanded={expanded}
              renderLink={renderLink}
              onNavigate={onNavigate}
            />
          </li>
        ))}
      </ul>

      {footer && (
        <div className="mt-2 border-t border-outline-variant pt-2">{footer(expanded)}</div>
      )}
    </nav>
  );
}

function RailItem({
  destination,
  active,
  expanded,
  renderLink,
  onNavigate,
}: {
  destination: NavDestination;
  active: boolean;
  expanded: boolean;
  renderLink: NavigationRailProps['renderLink'];
  onNavigate?: () => void;
}) {
  const activeStyles = active
    ? 'bg-secondary-container text-on-secondary-container [--md-state-color:var(--md-sys-color-on-secondary-container)]'
    : 'text-on-surface-variant [--md-state-color:var(--md-sys-color-on-surface-variant)]';

  if (expanded) {
    // Expanded: the indicator fills the item -- the drawer-style sidebar.
    return renderLink({
      to: destination.to,
      onClick: onNavigate,
      className: `md-state-layer md-label-large flex h-14 w-full items-center gap-3 rounded-full px-4 ${activeStyles}`,
      children: (
        <>
          <Icon name={destination.icon} size={24} filled={active} />
          <span className="flex-1 truncate">{destination.label}</span>
          {destination.badge !== undefined && <Badge count={destination.badge} />}
        </>
      ),
    });
  }

  /*
   * Collapsed: the indicator is a 56x32 pill that hugs the icon only, while the
   * link itself still spans the full rail width so the target stays 48dp+.
   */
  return renderLink({
    to: destination.to,
    onClick: onNavigate,
    className: 'flex w-full flex-col items-center gap-1 rounded-lg py-1',
    children: (
      <>
        <span
          className={`md-state-layer relative flex h-8 w-14 items-center justify-center rounded-full ${activeStyles}`}
        >
          <Icon name={destination.icon} size={24} filled={active} />
          {destination.badge !== undefined && (
            <span className="absolute -top-1 -right-1">
              <Badge count={destination.badge} />
            </span>
          )}
        </span>
        <span
          className={`md-label-medium ${active ? 'text-on-surface' : 'text-on-surface-variant'}`}
        >
          {destination.label}
        </span>
      </>
    ),
  });
}

/** M3 large badge: error container, on-error label, capped at 999+. */
function Badge({ count }: { count: number }) {
  return (
    <span className="md-label-small flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-on-error">
      {count > 999 ? '999+' : count}
    </span>
  );
}

/**
 * M3 navigation bar — compact windows only.
 *
 * The spec is explicit that the rail and the bar are never visible at the same
 * time; they are the same navigation, swapped at the medium breakpoint.
 */
export function NavigationBar({
  destinations,
  isActive,
  renderLink,
}: Pick<NavigationRailProps, 'destinations' | 'isActive' | 'renderLink'>) {
  return (
    <nav
      aria-label="Main navigation"
      className="m3-bar-slot fixed inset-x-0 bottom-0 z-30 h-20 items-center justify-around bg-surface-container px-2"
    >
      {destinations.map((destination) => {
        const active = isActive(destination.to);
        return renderLink({
          to: destination.to,
          className: 'flex flex-1 flex-col items-center gap-1 py-3',
          children: (
            <>
              <span
                className={[
                  'flex h-8 w-16 items-center justify-center rounded-full',
                  'transition-colors duration-200 ease-standard',
                  active
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'text-on-surface-variant',
                ].join(' ')}
              >
                <Icon name={destination.icon} size={24} filled={active} />
              </span>
              <span
                className={`md-label-medium ${active ? 'text-on-surface' : 'text-on-surface-variant'}`}
              >
                {destination.label}
              </span>
            </>
          ),
        });
      })}
    </nav>
  );
}
