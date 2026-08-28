import type { PublicPublication, PublicPublicationDetail } from "@/server/contracts/publication";
import { SITE_URL } from "@/lib/site-config";

export async function listPublicPublications(query = ""): Promise<PublicPublication[]> {
  const response = await fetch(SITE_URL + "/api/v1/published-publications" + query, {
    cache: "no-store",
  });
  if (!response.ok) return [];
  const payload = await response.json() as { publications?: PublicPublication[] };
  return Array.isArray(payload.publications) ? payload.publications : [];
}

export async function getPublicPublication(publicId: string): Promise<PublicPublicationDetail> {
  const response = await fetch(
    SITE_URL + "/api/v1/published-publications/" + encodeURIComponent(publicId),
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error("Publication not found");
  return response.json() as Promise<PublicPublicationDetail>;
}
