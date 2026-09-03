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

export type FieldProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "children" | "size"
> & {
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  multiline?: boolean;
  rows?: number;
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
        {multiline ? (
          <textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            className={styles.control}
            rows={rows}
            {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
            {...a11y}
          />
        ) : (
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            className={styles.control}
            type={type}
            {...rest}
            {...a11y}
          />
        )}
      </FieldShell>
    );
  },
);
