import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearPublicReadCache, publicReadCache, publicReadCacheStats } from "@/server/core/public-read-cache";

describe("public read cache", () => {
  beforeEach(() => {
    clearPublicReadCache();
  });

  it("serves the second read from cache and reports its hit ratio", async () => {
    const load = vi.fn(async () => "published");
    await expect(publicReadCache("brief", load)).resolves.toBe("published");
    await expect(publicReadCache("brief", load)).resolves.toBe("published");
    expect(load).toHaveBeenCalledTimes(1);
    expect(publicReadCacheStats()).toMatchObject({ hits: 1, misses: 1, hitRatio: 0.5, loads: 1 });
  });

  it("does not cache a failed read", async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error("database down"))
      .mockResolvedValueOnce("published");
    await expect(publicReadCache("brief", load)).rejects.toThrow("database down");
    await expect(publicReadCache("brief", load)).resolves.toBe("published");
    expect(load).toHaveBeenCalledTimes(2);
  });
});
