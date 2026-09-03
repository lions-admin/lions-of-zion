import React, { useId } from "react";
import { FieldMessage, describedBy } from "./Field";
import styles from "./field.module.css";

export type FieldGroupProps = Omit<
  React.FieldsetHTMLAttributes<HTMLFieldSetElement>,
  "children"
> & {
  legend: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
};

export function FieldGroup({
  legend,
  description,
  error,
  required,
  disabled,
  className = "",
  id,
  children,
  ...props
}: FieldGroupProps) {
  const generatedId = useId();
  const groupId = id ?? generatedId;

  return (
    <fieldset
      id={groupId}
      disabled={disabled}
      aria-required={required || undefined}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(groupId, description, error)}
      className={[styles.group, className].filter(Boolean).join(" ")}
      {...props}
    >
      <legend className={styles.legend}>
        {legend}
        {required ? <span className={styles.required}>required</span> : null}
      </legend>
      {description ? (
        <p id={`${groupId}-desc`} className={styles.description}>
          {description}
        </p>
      ) : null}
      {children}
      {error ? <FieldMessage id={`${groupId}-err`}>{error}</FieldMessage> : null}
    </fieldset>
  );
}
