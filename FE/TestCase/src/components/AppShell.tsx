import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Icon,
  IconButton,
  NavigationBar,
  NavigationRail,
  type NavDestination,
  type NavLinkRenderProps,
} from '@jasindo/shared';
import { useAuth } from '../hooks/useAuth';

const DESTINATIONS: NavDestination[] = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/users', label: 'Users', icon: 'group' },
  { to: '/about', label: 'About', icon: 'info' },
];

const RAIL_STATE_KEY = 'jasindo.rail.expanded';

/**
 * Admin dashboard shell, built on the M3 adaptive navigation rules:
 *
 *   compact   (<600dp)  navigation bar at the bottom + modal expanded rail
 *   medium    (600dp+)  collapsed rail, persistent
 *   expanded  (840dp+)  standard expanded rail — the persistent sidebar
 *
 * The rail is never hidden from medium up, and the rail and the bar are never
 * on screen together. Both are the same `NavigationRail` component in different
 * configurations, so switching between them is a width change, not a swap to a
 * different navigation pattern.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [modalOpen, setModalOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  // Expanded by default from the expanded breakpoint up, but the user's own
  // choice wins and survives a reload.
  const [expanded, setExpanded] = useState(() => {
    const stored = localStorage.getItem(RAIL_STATE_KEY);
    if (stored !== null) return stored === 'true';
    return window.matchMedia('(min-width: 840px)').matches;
  });

  useEffect(() => {
    localStorage.setItem(RAIL_STATE_KEY, String(expanded));
  }, [expanded]);

  // A modal rail is a temporary surface; navigating away should dismiss it.
  useEffect(() => {
    setModalOpen(false);
  }, [location.pathname]);

  /*
   * M3: the top app bar is `surface` when flat and switches to
   * `surface-container` once content scrolls beneath it. That tonal step is
   * how the bar reads as a separate layer -- M3 uses colour for elevation
   * rather than dropping a shadow.
   */
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isActive = (to: string) => location.pathname.startsWith(to);

  const renderLink = ({ to, className, children, onClick }: NavLinkRenderProps) => (
    <NavLink key={to} to={to} className={className} onClick={onClick}>
      {children}
    </NavLink>
  );

  // Takes the rail's own expanded state, not the shell's: the modal rail is
  // always expanded even while the persistent rail is collapsed.
  const railFooter = (railExpanded: boolean) =>
    user && (
      <div className={railExpanded ? 'px-2 py-2' : 'flex flex-col items-center gap-1 py-2'}>
        {railExpanded ? (
          <div className="flex items-center gap-3">
            <span className="md-title-medium flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
              {user.name.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="md-body-medium truncate text-on-surface">{user.name}</p>
              <p className="md-body-small truncate text-on-surface-variant">{user.role}</p>
            </div>
          </div>
        ) : (
          <span className="md-title-medium flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
            {user.name.charAt(0)}
          </span>
        )}
      </div>
    );

  return (
    <div className="min-h-screen bg-surface">
      <div className="flex">
        {/*
         * Persistent rail, medium and up. `sticky` + `h-screen` keeps the
         * destinations fixed while the body scrolls, which the spec requires.
         */}
        <div className="m3-rail-slot shrink-0 bg-surface-container">
          {/* The outer element stretches to the full scroll height so the rail's
              surface colour does not stop at the fold; the inner one is what
              actually sticks. */}
          <div className="sticky top-0 h-screen">
            <NavigationRail
              destinations={DESTINATIONS}
              isActive={isActive}
              renderLink={renderLink}
              expanded={expanded}
              onToggle={() => setExpanded((v) => !v)}
              footer={railFooter}
            />
          </div>
        </div>

        {/* Modal expanded rail, compact only — opened from the app bar menu. */}
        {modalOpen && (
          <div className="m3-bar-slot fixed inset-0 z-50">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setModalOpen(false)}
              className="absolute inset-0 bg-scrim/32"
            />
            <div className="absolute inset-y-0 left-0 shadow-level1">
              <NavigationRail
                destinations={DESTINATIONS}
                isActive={isActive}
                renderLink={renderLink}
                expanded
                onToggle={() => setModalOpen(false)}
                footer={railFooter}
                onNavigate={() => setModalOpen(false)}
              />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* M3 top app bar, small — 64dp, on surface. */}
          <header
            className={[
              'sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 px-2 medium:px-4',
              'transition-colors duration-200 ease-standard',
              scrolled ? 'bg-surface-container' : 'bg-surface',
            ].join(' ')}
          >
            <div className="m3-bar-slot">
              <IconButton icon="menu" label="Open navigation" onClick={() => setModalOpen(true)} />
            </div>

            <div className="flex items-center gap-3 px-1">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container">
                <Icon name="shield_person" size={24} className="text-on-primary-container" filled />
              </span>
              <span className="md-title-large text-on-surface">Jasindo</span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {user && (
                <>
                  <span className="md-label-small hidden rounded-sm bg-tertiary-container px-2 py-1 text-on-tertiary-container medium:inline">
                    {user.role}
                  </span>
                  <IconButton icon="logout" label="Sign out" onClick={logout} />
                </>
              )}
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 pb-24 medium:px-6 medium:pb-8">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </div>

      <NavigationBar destinations={DESTINATIONS} isActive={isActive} renderLink={renderLink} />
    </div>
  );
}
