"use client";

/**
 * Reveal — content arrives when it is scrolled to, once.
 *
 * The Magic UI original (`blur-fade`) wraps every instance in
 * `AnimatePresence` + `motion.div` and re-runs `useInView` per node. This
 * keeps the same visual contract — opacity, a short shift, a focus pull —
 * and drops the runtime to one shared IntersectionObserver for the whole
 * document plus one attribute write per element.
 *
 * `children` is a prop, so a server component passed into it stays a server
 * component. This wrapper is the smallest client boundary that can do the
 * job (§23), and it is why no page had to become `"use client"`.
 */

import {
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
} from "react";
import styles from "./reveal.module.css";

export type RevealDirection = "up" | "down" | "left" | "right" | "none";

/* A closed set rather than a free `ElementType` generic. Reveal wraps
   editorial structure, and these are the elements that structure is made of;
   a generic here costs the callers their prop checking (every prop widens to
   `never`) to buy an `as` nobody needs. Same call `components/ui/Card` makes. */
export type RevealTag =
  | "div"
  | "section"
  | "article"
  | "aside"
  | "header"
  | "footer"
  | "li"
  | "ol"
  | "ul"
  | "p"
  | "figure"
  | "figcaption"
  | "blockquote"
  | "h2"
  | "h3"
  | "h4"
  | "span";

/* One observer for the document, not one per element. Elements register
   themselves; the callback unregisters each as it fires, because a reveal is
   a once-only event. */
let sharedObserver: IntersectionObserver | null = null;

function observe(element: HTMLElement) {
  if (typeof IntersectionObserver === "undefined") {
    element.dataset.reveal = "shown";
    return () => {};
  }

  sharedObserver ??= new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.reveal = "shown";
        observer.unobserve(entry.target);
      }
    },
    /* Fires a little before the element's top edge reaches the fold, so the
       transition is finishing rather than starting as it becomes readable. */
    { rootMargin: "0px 0px -10% 0px", threshold: 0.01 },
  );

  sharedObserver.observe(element);
  return () => sharedObserver?.unobserve(element);
}

export interface RevealProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  as?: RevealTag;
  /** Milliseconds. Use `index` instead when staggering a list. */
  delay?: number;
  /** Position in a group; multiplied by `--stagger` and added to `delay`. */
  index?: number;
  direction?: RevealDirection;
  className?: string;
  style?: CSSProperties;
  children?: React.ReactNode;
}

export function Reveal({
  as,
  delay = 0,
  index = 0,
  direction = "up",
  className,
  style,
  children,
  ...rest
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    /* Reduced motion resolves before the observer is ever created: the
       content is simply already there. */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.dataset.reveal = "shown";
      return;
    }

    /* Arming cancels the un-hydrated failsafe. Reaching this line is the
       proof the failsafe was insuring against, and `armed` looks exactly
       like `pending`, so nothing moves. */
    element.dataset.reveal = "armed";

    return observe(element);
  }, []);

  const Tag = (as ?? "div") as "div";

  /* The stagger step is `--stagger` in the token file, not a number here, so
     one edit there retimes every sequence on the site. */
  const revealDelay =
    index > 0
      ? `calc(${index} * var(--stagger) + ${delay}ms)`
      : delay
        ? `${delay}ms`
        : undefined;

  return (
    <Tag
      ref={ref}
      data-reveal="pending"
      className={[styles.reveal, styles[direction], className].filter(Boolean).join(" ")}
      style={
        revealDelay
          ? ({ ...style, "--reveal-delay": revealDelay } as CSSProperties)
          : style
      }
      {...rest}
    >
      {children}
    </Tag>
  );
}
