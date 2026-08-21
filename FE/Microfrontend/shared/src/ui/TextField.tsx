import { useId, type InputHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './Icon';

interface FieldShellProps {
  label: string;
  error?: string;
  supportingText?: string;
  leadingIcon?: string;
  trailingIcon?: ReactNode;
  disabled?: boolean;
  /** Controls that are never "empty" (a select) keep the label floated. */
  alwaysFloating?: boolean;
  children: (props: { id: string; describedBy: string | undefined }) => ReactNode;
}

/**
 * M3 filled text field.
 *
 * Filled rather than outlined on purpose: the outlined variant's label sits
 * *on* the border, which means notching the outline behind it. Doing that
 * reliably needs a fieldset/legend and still breaks when the field moves to a
 * different surface colour. Both variants offer identical functionality, so
 * the spec treats the choice as style alone.
 *
 * Anatomy (56dp): container, optional leading icon, label, input text,
 * optional trailing icon, active indicator, supporting or error text.
 *
 * The label starts centred and floats to the top on focus or once populated --
 * that behaviour lives in `.m3-field` in the shared theme, because it is a
 * multi-property state transition rather than a static style.
 */
function FieldShell({
  label,
  error,
  supportingText,
  leadingIcon,
  trailingIcon,
  disabled,
  alwaysFloating,
  children,
}: FieldShellProps) {
  const id = useId();
  const helpId = `${id}-help`;
  // Error text replaces supporting text rather than joining it, so the field
  // does not grow and shove the rest of the form down.
  const help = error ?? supportingText;

  return (
    <div className="w-full">
      <div
        className={[
          'm3-field',
          error ? 'm3-field--error' : '',
          disabled ? 'm3-field--disabled' : '',
          alwaysFloating ? 'm3-field--floating' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {leadingIcon && (
          <Icon
            name={leadingIcon}
            size={24}
            className={`shrink-0 ${error ? 'text-error' : 'text-on-surface-variant'}`}
          />
        )}

        {/* The control comes before the label: the floating-label rule keys off
            `:focus`/`:placeholder-shown` on a preceding sibling. */}
        <div className="m3-field__body">
          {children({ id, describedBy: help ? helpId : undefined })}
          <label htmlFor={id} className="m3-field__label">
            {label}
          </label>
        </div>

        {/* The spec strongly recommends an error icon: a second, non-colour
            signal for anyone who cannot rely on the red. */}
        {error ? (
          <Icon name="error" size={24} className="shrink-0 text-error" />
        ) : (
          trailingIcon
        )}

        <span aria-hidden="true" className="m3-field__indicator" />
        <span aria-hidden="true" className="m3-field__indicator-active" />
      </div>

      {help && (
        <p
          id={helpId}
          className={`md-body-small mt-1 px-4 ${error ? 'text-error' : 'text-on-surface-variant'}`}
        >
          {help}
        </p>
      )}
    </div>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'id'> {
  label: string;
  error?: string;
  supportingText?: string;
  leadingIcon?: string;
  trailingIcon?: ReactNode;
}

export function TextField({
  label,
  error,
  supportingText,
  leadingIcon,
  trailingIcon,
  ...rest
}: TextFieldProps) {
  return (
    <FieldShell
      label={label}
      error={error}
      supportingText={supportingText}
      leadingIcon={leadingIcon}
      trailingIcon={trailingIcon}
      disabled={rest.disabled}
    >
      {({ id, describedBy }) => (
        <input
          {...rest}
          id={id}
          /* A single space, not omitted: :placeholder-shown is what tells the
             label whether the field is empty. */
          placeholder=" "
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="m3-field__control"
        />
      )}
    </FieldShell>
  );
}

interface SelectFieldProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'id'> {
  label: string;
  error?: string;
  supportingText?: string;
  leadingIcon?: string;
  children: ReactNode;
}

export function SelectField({
  label,
  error,
  supportingText,
  leadingIcon,
  children,
  ...rest
}: SelectFieldProps) {
  return (
    <FieldShell
      label={label}
      error={error}
      supportingText={supportingText}
      leadingIcon={leadingIcon}
      disabled={rest.disabled}
      alwaysFloating
      trailingIcon={
        <Icon
          name="arrow_drop_down"
          size={24}
          className="pointer-events-none shrink-0 text-on-surface-variant"
        />
      }
    >
      {({ id, describedBy }) => (
        <select
          {...rest}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="m3-field__control appearance-none"
        >
          {children}
        </select>
      )}
    </FieldShell>
  );
}
