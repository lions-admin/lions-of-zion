import { describe, expect, it, vi } from "vitest";

const { revalidatePath, revalidateTag } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath, revalidateTag }));

import { expirePublicPublicationCache } from "@/server/core/publication-cache";

describe("public publication cache expiration", () => {
  it("expires every public editorial surface after a publication mutation", () => {
    expirePublicPublicationCache();

    expect(revalidateTag).toHaveBeenCalledWith("publications", { expire: 0 });
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/geopolitical-brief");
    expect(revalidatePath).toHaveBeenCalledWith("/war-update");
    expect(revalidatePath).toHaveBeenCalledWith("/articles/[publicId]", "page");
    expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
  });
});
