import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * M3 defines five button configurations, ordered by emphasis:
 *
 *   filled  > tonal > elevated > outlined > text
 *
 * They are not interchangeable styles -- picking one is a statement about how
 * important the action is. Exactly one filled button per view, as the single
 * primary action.
 */
export type ButtonVariant = 'filled' | 'tonal' | 'elevated' | 'outlined' | 'text';

/** M3 Expressive sizes. `small` (40dp) is the default. */
export type ButtonSize = 'extra-small' | 'small' | 'medium' | 'large';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Material Symbols glyph name for a leading icon. */
  icon?: string;
  /** Square corners instead of the default full rounding. */
  square?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
  className?: string;
}

/*
 * Each variant sets --md-state-color to its own *content* colour, because the
 * M3 state layer is an overlay in the content colour -- not a darker version
 * of the container.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  filled:
    'bg-primary text-on-primary [--md-state-color:var(--md-sys-color-on-primary)] ' +
    'hover:shadow-level1 disabled:bg-on-surface/12 disabled:text-on-surface/38 disabled:shadow-none',
  tonal:
    'bg-secondary-container text-on-secondary-container [--md-state-color:var(--md-sys-color-on-secondary-container)] ' +
    'hover:shadow-level1 disabled:bg-on-surface/12 disabled:text-on-surface/38 disabled:shadow-none',
  elevated:
    'bg-surface-container-low text-primary shadow-level1 [--md-state-color:var(--md-sys-color-primary)] ' +
    'hover:shadow-level2 disabled:bg-on-surface/12 disabled:text-on-surface/38 disabled:shadow-none',
  outlined:
    'bg-transparent text-primary border border-outline-variant [--md-state-color:var(--md-sys-color-primary)] ' +
    'disabled:border-on-surface/12 disabled:text-on-surface/38',
  text:
    'bg-transparent text-primary [--md-state-color:var(--md-sys-color-primary)] ' +
    'disabled:text-on-surface/38',
};

/* Heights and padding from the M3 Expressive size scale. */
const SIZES: Record<ButtonSize, string> = {
  'extra-small': 'h-8 px-3 gap-1 md-label-large',
  small: 'h-10 px-4 gap-2 md-label-large',
  medium: 'h-14 px-6 gap-2 md-title-medium',
  large: 'h-24 px-12 gap-3 md-headline-small',
};

const ICON_SIZE: Record<ButtonSize, 18 | 20 | 24> = {
  'extra-small': 20,
  small: 20,
  medium: 24,
  large: 24,
};

export function Button({
  variant = 'filled',
  size = 'small',
  icon,
  square = false,
  fullWidth = false,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={[
        'md-state-layer inline-flex shrink-0 items-center justify-center',
        'transition-shadow duration-200 ease-standard',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'disabled:pointer-events-none',
        square ? 'rounded-md' : 'rounded-full',
        fullWidth ? 'w-full' : '',
        SIZES[size],
        VARIANTS[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {icon && <Icon name={icon} size={ICON_SIZE[size]} />}
      {children}
    </button>
  );
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  icon: string;
  /** Required: an icon button has no visible label. */
  label: string;
  variant?: 'standard' | 'filled' | 'tonal' | 'outlined';
  selected?: boolean;
  className?: string;
}

const ICON_BUTTON_VARIANTS: Record<NonNullable<IconButtonProps['variant']>, string> = {
  standard: 'text-on-surface-variant [--md-state-color:var(--md-sys-color-on-surface-variant)]',
  filled: 'bg-primary text-on-primary [--md-state-color:var(--md-sys-color-on-primary)]',
  tonal:
    'bg-secondary-container text-on-secondary-container [--md-state-color:var(--md-sys-color-on-secondary-container)]',
  outlined:
    'border border-outline-variant text-on-surface-variant [--md-state-color:var(--md-sys-color-on-surface-variant)]',
};

/**
 * 40dp target inside a 48dp hit area, per the M3 states spec.
 */
export function IconButton({
  icon,
  label,
  variant = 'standard',
  selected = false,
  className = '',
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={[
        'md-state-layer inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'disabled:pointer-events-none disabled:text-on-surface/38',
        ICON_BUTTON_VARIANTS[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Icon name={icon} size={24} filled={selected} />
    </button>
  );
}
