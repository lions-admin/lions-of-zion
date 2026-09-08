import React, { forwardRef } from "react";
import Link from "next/link";
import styles from "./button.module.css";

/**
 * Product control.
 *
 * One hierarchy, decided once (UX-32, 2026-09-08) and read on every surface:
 *
 *   `primary`    solid — the single primary action on a task surface: the
 *                Ask send, a support card's action, a share sheet's first
 *                button. One per surface; a second solid button is a second
 *                primary action, which is a design error rather than a style.
 *   `secondary`  outline — the secondary action beside it. Alias: `outline`.
 *   `text`       link — navigation and quiet in-flow actions, set as an
 *                underlined link. Alias: `link`.
 *   `ghost`      chrome — toolbar and masthead controls that borrow the
 *                surface they sit on.
 *   `danger`     destructive, always outlined in the danger hue and never
 *                the only cue.
 *
 * `solid`, `toolbar` and `filter` remain as mapped aliases so existing
 * callers typecheck; `outline` and `link` are the hierarchy's own names for
 * `secondary` and `text`, added so a caller can say what it means.
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "text"
  | "danger"
  | "outline"
  | "link"
  | "solid"
  | "toolbar"
  | "filter";

export const BUTTON_SEMANTIC_VARIANTS = [
  "primary",
  "secondary",
  "ghost",
  "text",
  "danger",
] as const;

export type ButtonSize = "xs" | "sm" | "md" | "lg";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  ghost: styles.ghost,
  text: styles.text,
  danger: styles.danger,
  outline: styles.secondary,
  link: styles.text,
  /* `solid` predates the hierarchy and was mapped to the *secondary* plate,
     which is the opposite of what the word says today. It keeps that mapping
     on purpose: the callers that wrote it were asking for a neutral plate,
     not for the one primary action, and re-reading them as primary would put
     several solid buttons on one surface. New code says `primary`. */
  solid: styles.secondary,
  toolbar: styles.toolbar,
  filter: styles.filter,
};

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
  IconOnlyContract & {
    href: string;
    /**
     * Force a real document navigation instead of a client-side route change.
     *
     * A relative href normally goes through `next/link`, which both prefetches
     * the destination and navigates within the router. Neither is right when
     * the destination is a Route Handler that redirects off-site: prefetching
     * it *runs* it — for `/auth/x` that means minting OAuth state and spending
     * a `__Host-` cookie because a button scrolled into view — and the router
     * cannot follow a redirect to another origin anyway.
     *
     * Absolute hrefs already take this path; this says so for a relative one.
     */
    documentNavigation?: boolean;
  };

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
    VARIANT_CLASS[variant],
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

/**
 * The inside of a button, shared by both elements.
 *
 * A busy control keeps its width. The label and the icons stay in the flow
 * and are hidden by the stylesheet (`visibility`, not `display`), and the
 * spinner is laid over the centre — so "Send" does not narrow to a 1em dot
 * and back while the request is out, which is the layout shift §11 forbids.
 * Until 2026-09-08 the spinner *replaced* the left icon, which changed the
 * width of every busy button that had no icon to replace.
 */
function ButtonBody({
  isLoading,
  leftIcon,
  rightIcon,
  children,
}: Pick<CommonButtonProps, "isLoading" | "leftIcon" | "rightIcon" | "children">) {
  return (
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
      {isLoading ? (
        <>
          <span className={styles.spinner} aria-hidden="true" />
          <span className={styles.srOnly}>Loading</span>
        </>
      ) : null}
    </>
  );
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
        <ButtonBody isLoading={isLoading} leftIcon={leftIcon} rightIcon={rightIcon}>
          {children}
        </ButtonBody>
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
      documentNavigation = false,
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
      <ButtonBody isLoading={isLoading} leftIcon={leftIcon} rightIcon={rightIcon}>
        {children}
      </ButtonBody>
    );

    const shared = {
      className: combinedClassName,
      "aria-disabled": isLoading || undefined,
      "aria-busy": isLoading || undefined,
      /* A link is never a toggle; `isActive` on a ButtonLink means "this is
         where you are", which is `aria-current`, not `aria-pressed`. */
      "aria-current": props["aria-current"] ?? (isActive ? ("page" as const) : undefined),
    };

    if (
      documentNavigation ||
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
