/**
 * Host shim for `next/link`, for the Claude Design bundle only.
 *
 * Not a reimplementation of a Lions of Zion component — it is the same kind of
 * substitution the converter already makes for React (externalized to
 * `window.React`). Outside a Next app there is no router; `next/link` renders
 * an anchor and so does this. Every prop that changes appearance passes
 * through untouched, which is what keeps the rendered card faithful.
 */
import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from 'react';

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string | { pathname?: string };
  children?: ReactNode;
  /* Next-only routing hints; accepted and ignored, never forwarded to the DOM. */
  prefetch?: boolean | null;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  passHref?: boolean;
  legacyBehavior?: boolean;
  locale?: string | false;
};

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, children, prefetch, replace, scroll, shallow, passHref, legacyBehavior, locale, ...rest },
  ref,
) {
  const resolved = typeof href === 'string' ? href : (href?.pathname ?? '#');
  return (
    <a ref={ref} href={resolved} {...rest}>
      {children}
    </a>
  );
});

export default Link;
