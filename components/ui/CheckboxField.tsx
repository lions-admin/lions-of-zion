import React, { forwardRef, useId } from "react";
import { FieldMessage, describedBy } from "./Field";
import styles from "./field.module.css";

export type CheckboxFieldProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "children" | "size"
> & {
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
};

export const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(
  function CheckboxField(props, ref) {
    const generatedId = useId();
    const {
      label,
      description,
      error,
      required,
      disabled,
      className = "",
      id,
      ...rest
    } = props;
    const fieldId = id ?? generatedId;

    return (
      <div
        className={[styles.field, className].filter(Boolean).join(" ")}
        data-invalid={error ? "" : undefined}
        data-disabled={disabled ? "" : undefined}
      >
        <label className={styles.check} htmlFor={fieldId}>
          <input
            ref={ref}
            {...rest}
            id={fieldId}
            type="checkbox"
            className={styles.checkbox}
            disabled={disabled}
            required={required}
            aria-required={required || undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(fieldId, description, error)}
          />
          <span className={styles.checkText}>
            <span>
              {label}
              {required ? <span className={styles.required}>required</span> : null}
            </span>
          </span>
        </label>
        {description ? (
          <p id={`${fieldId}-desc`} className={styles.description}>
            {description}
          </p>
        ) : null}
        {error ? <FieldMessage id={`${fieldId}-err`}>{error}</FieldMessage> : null}
      </div>
    );
  },
);
