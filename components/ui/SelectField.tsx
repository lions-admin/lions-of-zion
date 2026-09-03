import React, { forwardRef, useId } from "react";
import { FieldShell, describedBy } from "./Field";
import styles from "./field.module.css";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SelectFieldProps = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "children"
> & {
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  options?: SelectOption[];
  children?: React.ReactNode;
};

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  function SelectField(props, ref) {
    const generatedId = useId();
    const {
      label,
      description,
      error,
      required,
      disabled,
      className,
      id,
      options,
      children,
      ...rest
    } = props;
    const fieldId = id ?? generatedId;

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
        <select
          ref={ref}
          className={styles.control}
          {...rest}
          id={fieldId}
          disabled={disabled}
          required={required}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fieldId, description, error)}
        >
          {children ??
            options?.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
        </select>
      </FieldShell>
    );
  },
);
