"use client";

/**
 * A `<details>` that opens when its own fragment is navigated to.
 *
 * Native fragment navigation scrolls to a closed `<details>` and leaves it
 * closed, so a reader following "News archive" from the jump row — or a shared
 * link to `/geopolitical-brief#news-archive` — landed on a summary and nothing
 * under it. The server component cannot know the URL's hash, so the element is
 * client-owned: it opens once on mount when the hash names it, again on every
 * later `hashchange`, and otherwise stays exactly as the server rendered it
 * (which is why `filtering` still opens the archive on a GET filter
 * submission without any JavaScript at all — the `open` attribute travels in
 * the HTML).
 *
 * The user's own toggling never fights this state: the browser mutates the
 * `open` attribute directly on click, and this component only writes `open`
 * on the hash events above.
 */
import { useEffect, useRef, useState } from "react";

export function HashDetails({
  id,
  initiallyOpen = false,
  className,
  children,
  ...props
}: Omit<React.HTMLAttributes<HTMLDetailsElement>, "open"> & { initiallyOpen?: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(initiallyOpen);

  useEffect(() => {
    const sync = () => {
      if (window.location.hash === `#${id}`) setOpen(true);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [id]);

  return (
    <details ref={ref} id={id} className={className} open={open} {...props}>
      {children}
    </details>
  );
}
