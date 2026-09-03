import type { ReactNode } from "react";
import {
  Card,
  CardDescription,
  CardEyebrow,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";

export type ContentCardProps = {
  eyebrow?: string;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  accent?: "gold" | "ember";
  href?: string;
};

/** SYS-008 — editorial card composed from the shared Card primitive. */
export function ContentCard({
  eyebrow,
  title,
  meta,
  children,
  footer,
  accent = "gold",
  href,
}: ContentCardProps) {
  return (
    <Card variant="feature" accent={accent} href={href}>
      {eyebrow ? (
        <CardHeader>
          <CardEyebrow>{eyebrow}</CardEyebrow>
        </CardHeader>
      ) : null}
      <CardTitle>{title}</CardTitle>
      {meta ? <CardDescription>{meta}</CardDescription> : null}
      <CardDescription>{children}</CardDescription>
      {footer ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
  );
}
