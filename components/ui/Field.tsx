import React, { forwardRef, useId } from "react";
import styles from "./field.module.css";

export type FieldMessageProps = {
  id?: string;
  children: React.ReactNode;
  className?: string;
};

/** Visible validation text. Wired to the control via `aria-describedby`. */
export function FieldMessage({ id, children, className = "" }: FieldMessageProps) {
  return (
    <p id={id} className={`${styles.error} ${className}`.trim()} role="alert">
      {children}
    </p>
  );
}

export type FieldShellProps = {
  fieldId: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function describedBy(
  fieldId: string,
  description?: React.ReactNode,
  error?: React.ReactNode,
): string | undefined {
  const ids = [
    description ? `${fieldId}-desc` : null,
    error ? `${fieldId}-err` : null,
  ].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

export function FieldShell({
  fieldId,
  label,
  description,
  error,
  required,
  disabled,
  className = "",
  children,
}: FieldShellProps) {
  return (
    <div
      className={[styles.field, className].filter(Boolean).join(" ")}
      data-invalid={error ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
    >
      <label htmlFor={fieldId} className={styles.label}>
        {label}
        {required ? <span className={styles.required}>required</span> : null}
      </label>
      {description ? (
        <p id={`${fieldId}-desc`} className={styles.description}>
          {description}
        </p>
      ) : null}
      {children}
      {error ? <FieldMessage id={`${fieldId}-err`}>{error}</FieldMessage> : null}
    </div>
  );
}

export type FieldControlProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "children" | "size"
> & {
  /** A `<textarea>` that grows with its content, instead of an `<input>`. */
  multiline?: boolean;
  rows?: number;
};

/**
 * The bare control: the input box with the system's well, hairline, focus
 * ring and type, and none of the label, description or error chrome. It is
 * for the surfaces that carry their own — the search combobox, whose label
 * and live summary are already wired by hand, or an archive filter whose
 * label sits inline beside it. Everywhere else, render `Field`, which is
 * this control inside `FieldShell`; before 2026-09-16 the search panel
 * reached into `field.module.css` for the class instead, which is the kind
 * of import a primitive exists to make unnecessary.
 *
 * The class itself is `composes: control from "./field.module.css"`-able
 * from another stylesheet (relative path), for a rule that wants to add
 * layout to the control rather than re-state it.
 */
export const FieldControl = forwardRef<HTMLInputElement | HTMLTextAreaElement, FieldControlProps>(
  function FieldControl({ multiline = false, rows = 4, className, type, ...rest }, ref) {
    const classes = [styles.control, className].filter(Boolean).join(" ");
    return multiline ? (
      <textarea
        ref={ref as React.Ref<HTMLTextAreaElement>}
        className={classes}
        rows={rows}
        {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
      />
    ) : (
      <input ref={ref as React.Ref<HTMLInputElement>} className={classes} type={type} {...rest} />
    );
  },
);

export type FieldProps = FieldControlProps & {
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
};

export const Field = forwardRef<HTMLInputElement | HTMLTextAreaElement, FieldProps>(
  function Field(props, ref) {
    const generatedId = useId();
    const {
      label,
      description,
      error,
      required,
      disabled,
      className,
      id,
      multiline = false,
      rows = 4,
      type,
      ...rest
    } = props;
    const fieldId = id ?? generatedId;
    const a11y = {
      id: fieldId,
      disabled,
      required,
      "aria-required": required || undefined,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": describedBy(fieldId, description, error),
    };

    return (
      <FieldShell
        fieldId={fieldId}
        label={label}
        description={description}
        error={error}
        required={required}
        disabled={disabled}
        className={className}
      >
        <FieldControl ref={ref} multiline={multiline} rows={rows} type={type} {...rest} {...a11y} />
      </FieldShell>
    );
  },
);
