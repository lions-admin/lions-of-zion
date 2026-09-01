import React from "react";
import styles from "./status-state.module.css";
import { Button, ButtonLink } from "./Button";

interface StatusStateProps {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionText?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

export function StatusState({
  eyebrow = "ARCHIVE STATUS",
  title,
  description,
  icon,
  actionText,
  actionHref,
  onAction,
  className = "",
}: StatusStateProps) {
  return (
    <div className={`${styles.container} ${className}`} role="status">
      <div className={styles.inner}>
        {icon ? <div className={styles.icon}>{icon}</div> : null}
        {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
        <h3 className={styles.title}>{title}</h3>
        {description ? <p className={styles.description}>{description}</p> : null}
        {actionText ? (
          <div className={styles.action}>
            {actionHref ? (
              <ButtonLink href={actionHref} variant="secondary" size="md">
                {actionText}
              </ButtonLink>
            ) : onAction ? (
              <Button onClick={onAction} variant="secondary" size="md">
                {actionText}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
