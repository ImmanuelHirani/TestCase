interface IconProps {
  /** Material Symbols glyph name, e.g. "search", "delete", "chevron_right". */
  name: string;
  /** Optical size in dp. M3 uses 20dp inside buttons, 24dp standalone. */
  size?: 18 | 20 | 24 | 40 | 48;
  filled?: boolean;
  className?: string;
}

/**
 * Material Symbols Rounded, the M3 icon set.
 *
 * The variable font exposes FILL as an axis rather than shipping two families,
 * so an outlined icon becomes its filled counterpart by animating one axis --
 * which is how M3 renders selected navigation states.
 */
export function Icon({ name, size = 24, filled = false, className = '' }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-rounded select-none ${className}`}
      style={{
        fontSize: `${size}px`,
        width: `${size}px`,
        height: `${size}px`,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
      }}
    >
      {name}
    </span>
  );
}
