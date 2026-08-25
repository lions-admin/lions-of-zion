import type { ReactNode } from 'react';
import Link from 'next/link';
import styles from './content.module.css';

export type ContentCardProps = {
  eyebrow?: string;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  accent?: 'gold' | 'ember';
  href?: string;
};

export function ContentCard({
  eyebrow,
  title,
  meta,
  children,
  footer,
  accent = 'gold',
  href,
}: ContentCardProps) {
  return (
    <article className={styles.card} data-accent={accent}>
      {eyebrow ? <p className={styles.cardEyebrow}>{eyebrow}</p> : null}
      <h3>{href ? <Link href={href}>{title}</Link> : title}</h3>
      {meta ? <div className={styles.cardMeta}>{meta}</div> : null}
      <div className={styles.cardBody}>{children}</div>
      {footer ? <div className={styles.cardFooter}>{footer}</div> : null}
    </article>
  );
}
