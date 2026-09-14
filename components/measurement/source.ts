/** Parse utm_* / ref / m from the current URL. Unknown stays unknown server-side. */
export function readTaggedSource(search: string): {
  source?: string;
  medium?: string;
  campaign?: string;
  content_link?: string;
} {
  const params = new URLSearchParams(search);
  const source = params.get("utm_source") || params.get("ref") || undefined;
  const medium = params.get("utm_medium") || params.get("m") || undefined;
  const campaign = params.get("utm_campaign") || undefined;
  const content_link = params.get("utm_content") || undefined;
  return {
    source: source || undefined,
    medium: medium || undefined,
    campaign: campaign || undefined,
    content_link: content_link || undefined,
  };
}

export function deviceClass(): string {
  if (typeof window === "undefined") return "unknown";
  const w = window.innerWidth;
  if (w < 768) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

export function honourDoNotTrack(): boolean {
  if (typeof navigator === "undefined") return false;
  const dnt = (navigator as Navigator & { doNotTrack?: string }).doNotTrack;
  if (dnt === "1" || dnt === "yes") return true;
  try {
    if (typeof document !== "undefined" && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
