import React, { forwardRef } from "react";
import Link from "next/link";
import styles from "./button.module.css";

/**
 * The control primitive. Seven variants, four sizes, an icon-only shape, and
 * the full state matrix: default · hover · focus-visible · active · disabled ·
 * loading · active(toggle) · reduced motion.
 *
 * `components/ui/README.md` maps every variant to the shipping control it is
 * meant to replace. Read it before adding an eighth.
 */
export type ButtonVariant =
  | "primary"
  | "solid"
  | "secondary"
  | "toolbar"
  | "filter"
  | "ghost"
  | "danger";

export type ButtonSize = "xs" | "sm" | "md" | "lg";

interface CommonButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Marks a toggle as pressed. Passing it at all declares the control a
   *  toggle, so the component emits `aria-pressed` — see `ariaPressedFor`. */
  isActive?: boolean;
  isLoading?: boolean;
  /** Square control carrying only an icon. The union below makes
   *  `aria-label` mandatory when this is true, so a nameless icon button
   *  fails the typecheck rather than shipping unreadable. */
  iconOnly?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** `iconOnly` buys its own accessible name. */
type IconOnlyContract =
  | { iconOnly: true; "aria-label": string }
  | { iconOnly?: false | undefined };

export type ButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> &
  CommonButtonProps &
  IconOnlyContract;

export type ButtonLinkProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "children"
> &
  CommonButtonProps &
  IconOnlyContract & { href: string };

function getButtonClassName(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  isActive = false,
  isLoading = false,
  iconOnly = false,
  customClassName = "",
) {
  return [
    styles.button,
    styles[variant],
    styles[size],
    iconOnly ? styles.iconOnly : "",
    isActive ? styles.active : "",
    isLoading ? styles.loading : "",
    customClassName,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * `isActive` is a visual state *and* a semantic one, and it used to be only
 * the first: a pressed filter chip looked selected and announced nothing.
 *
 * The rule: passing `isActive` at all is what declares the control a toggle,
 * so `aria-pressed` is emitted with its real value — `false` included, since
 * a toggle that only announces itself when on is worse than one that never
 * does. A caller that has already said what the control is (`aria-pressed`
 * by hand, `aria-current` for navigation, `aria-selected`/`role` for a tab)
 * keeps its own answer; nothing here overrides it.
 */
function ariaPressedFor(
  props: { isActive?: boolean } & React.AriaAttributes & { role?: string },
): boolean | undefined {
  if ("aria-pressed" in props) return props["aria-pressed"] as boolean | undefined;
  if (!("isActive" in props)) return undefined;
  if (props["aria-current"] !== undefined) return undefined;
  if (props["aria-selected"] !== undefined) return undefined;
  if (props.role !== undefined) return undefined;
  return Boolean(props.isActive);
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(props, ref) {
    const {
      variant = "primary",
      size = "md",
      isActive = false,
      isLoading = false,
      iconOnly = false,
      leftIcon,
      rightIcon,
      className,
      children,
      disabled,
      type = "button",
      ...rest
    } = props;

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        aria-pressed={ariaPressedFor(props)}
        className={getButtonClassName(
          variant,
          size,
          isActive,
          isLoading,
          iconOnly,
          className,
        )}
        {...rest}
      >
        {isLoading ? (
          <span className={styles.spinner} aria-hidden="true" />
        ) : leftIcon ? (
          <span className={styles.icon} aria-hidden="true">
            {leftIcon}
          </span>
        ) : null}
        <span className={styles.content}>{children}</span>
        {!isLoading && rightIcon ? (
          <span className={styles.icon} aria-hidden="true">
            {rightIcon}
          </span>
        ) : null}
      </button>
    );
  },
);

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  function ButtonLink(props, ref) {
    const {
      variant = "primary",
      size = "md",
      isActive = false,
      isLoading = false,
      iconOnly = false,
      leftIcon,
      rightIcon,
      className,
      children,
      href,
      ...rest
    } = props;

    const combinedClassName = getButtonClassName(
      variant,
      size,
      isActive,
      isLoading,
      iconOnly,
      className,
    );

    const body = (
      <>
        {leftIcon ? (
          <span className={styles.icon} aria-hidden="true">
            {leftIcon}
          </span>
        ) : null}
        <span className={styles.content}>{children}</span>
        {rightIcon ? (
          <span className={styles.icon} aria-hidden="true">
            {rightIcon}
          </span>
        ) : null}
      </>
    );

    const shared = {
      className: combinedClassName,
      "aria-disabled": isLoading || undefined,
      /* A link is never a toggle; `isActive` on a ButtonLink means "this is
         where you are", which is `aria-current`, not `aria-pressed`. */
      "aria-current": props["aria-current"] ?? (isActive ? ("page" as const) : undefined),
    };

    if (
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("mailto:")
    ) {
      return (
        <a ref={ref} href={href} {...shared} {...rest}>
          {body}
        </a>
      );
    }

    return (
      <Link ref={ref} href={href} {...shared} {...rest}>
        {body}
      </Link>
    );
  },
);
