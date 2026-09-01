import React, { forwardRef } from "react";
import Link from "next/link";
import styles from "./button.module.css";

export type ButtonVariant = "primary" | "secondary" | "filter" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface CommonButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isActive?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">,
    CommonButtonProps {}

export interface ButtonLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "children">,
    CommonButtonProps {
  href: string;
}

function getButtonClassName(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  isActive = false,
  isLoading = false,
  customClassName = ""
) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    isActive ? styles.active : "",
    isLoading ? styles.loading : "",
    customClassName,
  ];
  return classes.filter(Boolean).join(" ");
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isActive = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      className,
      children,
      disabled,
      type = "button",
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        className={getButtonClassName(variant, size, isActive, isLoading, className)}
        {...props}
      >
        {isLoading ? (
          <span className={styles.spinner} aria-hidden="true" />
        ) : leftIcon ? (
          <span className={styles.icon}>{leftIcon}</span>
        ) : null}
        <span className={styles.content}>{children}</span>
        {!isLoading && rightIcon ? <span className={styles.icon}>{rightIcon}</span> : null}
      </button>
    );
  }
);

Button.displayName = "Button";

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  (
    {
      variant = "primary",
      size = "md",
      isActive = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      className,
      children,
      href,
      ...props
    },
    ref
  ) => {
    const combinedClassName = getButtonClassName(
      variant,
      size,
      isActive,
      isLoading,
      className
    );

    if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:")) {
      return (
        <a ref={ref} href={href} className={combinedClassName} {...props}>
          {leftIcon ? <span className={styles.icon}>{leftIcon}</span> : null}
          <span className={styles.content}>{children}</span>
          {rightIcon ? <span className={styles.icon}>{rightIcon}</span> : null}
        </a>
      );
    }

    return (
      <Link ref={ref} href={href} className={combinedClassName} {...props}>
        {leftIcon ? <span className={styles.icon}>{leftIcon}</span> : null}
        <span className={styles.content}>{children}</span>
        {rightIcon ? <span className={styles.icon}>{rightIcon}</span> : null}
      </Link>
    );
  }
);

ButtonLink.displayName = "ButtonLink";
