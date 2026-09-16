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
    /* `tile` is the pressable plate this card has always drawn;
       `feature` was the name for it until 2026-09-16 and resolves to the
       same composition. Named directly here so the legacy alias has one
       caller left rather than two. */
    <Card variant="tile" accent={accent} href={href}>
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
