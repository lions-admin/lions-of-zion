import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { clearPublicReadCache } from "./public-read-cache";

/**
 * Public briefing surfaces must not wait for the queued outbox delivery after
 * an administrator edits, archives, deletes, publishes, or features a story.
 * Route handlers call this only after the underlying transaction succeeds.
 */
export function expirePublicPublicationCache(): void {
  // Route handlers are an external mutation boundary, so expire immediately
  // rather than serving one stale response with the default `max` profile.
  revalidateTag("publications", { expire: 0 });
  clearPublicReadCache();
  revalidatePath("/");
  revalidatePath("/geopolitical-brief");
  revalidatePath("/war-update");
  revalidatePath("/articles/[publicId]", "page");
  revalidatePath("/sitemap.xml");
}
