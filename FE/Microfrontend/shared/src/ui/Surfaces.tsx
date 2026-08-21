import { useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Icon } from './Icon';

/*
 * M3's own easing curves, reused as Framer Motion transitions instead of
 * inventing separate ones -- a dialog materialising should move the same way
 * the CSS-driven parts of the app do (buttons, the state layer, the nav
 * rail's expand/collapse), not with framer's own defaults layered on top.
 */
const EMPHASIZED_DECELERATE = [0.05, 0.7, 0.1, 1] as const;
const STANDARD = [0.2, 0, 0, 1] as const;

type CardVariant = 'elevated' | 'filled' | 'outlined';

const CARD_VARIANTS: Record<CardVariant, string> = {
  elevated: 'bg-surface-container-low shadow-level1',
  filled: 'bg-surface-container-highest',
  outlined: 'bg-surface border border-outline-variant',
};

/**
 * M3 card. Corner radius medium (12dp) for all three variants.
 *
 * Outlined cards use outline-variant, never outline -- outline is reserved for
 * boundaries that must carry 3:1 contrast on their own, and a card's contents
 * already provide that.
 */
export function Card({
  variant = 'outlined',
  className = '',
  children,
}: {
  variant?: CardVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-md ${CARD_VARIANTS[variant]} ${className}`}>{children}</div>
  );
}

/**
 * M3 dialog: surface-container-high, 28dp corners, level-3 elevation,
 * scrim at 32% over the content behind it.
 */
export function Dialog({
  headline,
  icon,
  onClose,
  children,
  actions,
}: {
  headline: string;
  icon?: string;
  onClose: () => void;
  children: ReactNode;
  actions: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center medium:items-center medium:p-6">
      <motion.button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-scrim/32"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: STANDARD }}
      />

      {/*
       * M3's container-transform spirit for a modal: it grows from a slightly
       * smaller, slightly lower resting point rather than just fading in --
       * emphasized-decelerate is the token M3 specifies for exactly this,
       * an element arriving and settling into place.
       */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={headline}
        className="relative flex max-h-[90vh] w-full flex-col bg-surface-container-high shadow-level3 medium:max-w-md"
        style={{
          borderRadius: 'var(--md-sys-shape-corner-extra-large)',
          borderBottomLeftRadius: undefined,
        }}
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EMPHASIZED_DECELERATE }}
      >
        <div className="px-6 pt-6">
          {icon && (
            <div className="mb-4 flex justify-center">
              <Icon name={icon} size={24} className="text-secondary" />
            </div>
          )}
          <h2 className={`md-headline-small text-on-surface ${icon ? 'text-center' : ''}`}>
            {headline}
          </h2>
        </div>

        <div className="md-body-medium flex-1 overflow-y-auto px-6 pt-4 text-on-surface-variant">
          {children}
        </div>

        {/* M3 dialog actions are text buttons, right-aligned, confirm last. */}
        <div className="flex justify-end gap-2 px-6 pt-6 pb-6">{actions}</div>
      </motion.div>
    </div>
  );
}

/**
 * M3 filter chip. Selected state swaps to secondary-container and gains a
 * leading checkmark rather than only changing colour.
 */
export function FilterChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={[
        'md-state-layer md-label-large inline-flex h-8 items-center gap-2 rounded-sm px-4',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        selected
          ? 'bg-secondary-container text-on-secondary-container [--md-state-color:var(--md-sys-color-on-secondary-container)]'
          : 'border border-outline-variant text-on-surface-variant [--md-state-color:var(--md-sys-color-on-surface-variant)]',
      ].join(' ')}
    >
      {selected && <Icon name="check" size={18} />}
      {label}
    </button>
  );
}

/**
 * M3 snackbar: inverse-surface container with inverse-primary action, so it
 * reads as a layer above the UI rather than part of it.
 */
export function Snackbar({
  message,
  action,
  onAction,
}: {
  message: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <motion.div
      role="status"
      className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-xs bg-inverse-surface px-4 py-3 shadow-level3"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.25, ease: EMPHASIZED_DECELERATE }}
    >
      <p className="md-body-medium flex-1 text-inverse-on-surface">{message}</p>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className="md-label-large shrink-0 rounded-xs px-2 py-1 text-inverse-primary"
        >
          {action}
        </button>
      )}
    </motion.div>
  );
}

/**
 * M3 linear progress indicator, determinate.
 *
 * Track is secondary-container, active indicator is primary, 4dp tall with
 * fully rounded ends. Used here for proportion bars, which is why it takes a
 * ratio rather than a percentage string.
 */
export function LinearProgress({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className="h-1 w-full overflow-hidden rounded-full bg-secondary-container"
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-500 ease-emphasized"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
