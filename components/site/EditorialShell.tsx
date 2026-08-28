import type { ReactNode } from "react";
import { ReadingProgress } from "@/components/sections/ReadingProgress";
import { ScanBackdrop } from "@/components/sections/ScanBackdrop";
import { resolveSiteSectionId } from "@/lib/site-navigation";
import { SiteHeader } from "./SiteHeader";

interface EditorialShellProps {
  routeId: string;
  backdropSeed?: string;
  register?: "default" | "muted";
  showProgress?: boolean;
  className: string;
  skipLinkClassName: string;
  progressTrackClassName: string;
  progressValueClassName: string;
  children: ReactNode;
}

export function EditorialShell({
  routeId,
  backdropSeed,
  register = "default",
  showProgress = true,
  className,
  skipLinkClassName,
  progressTrackClassName,
  progressValueClassName,
  children,
}: EditorialShellProps) {
  return (
    <main className={className} data-reading-scroll>
      <a href="#page-content" className={skipLinkClassName}>
        Skip to content
      </a>
      {showProgress ? (
        <ReadingProgress
          trackClassName={progressTrackClassName}
          valueClassName={progressValueClassName}
        />
      ) : null}
      <ScanBackdrop routeId={routeId} seed={backdropSeed} register={register} />
      <SiteHeader activeSection={resolveSiteSectionId(routeId)} />
      {children}
    </main>
  );
}
