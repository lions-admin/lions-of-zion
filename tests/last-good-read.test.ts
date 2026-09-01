import { describe, expect, it } from "vitest";
import { LAST_GOOD_READ_TTL_MS, withLastGoodRead, type LastGoodValue } from "@/server/core/last-good-read";

describe("last good public read", () => {
  it("returns the last complete value during a temporary failure", async () => {
    const cache = new Map<string, LastGoodValue<string>>();
    let now = 1_000;
    expect(await withLastGoodRead("brief", async () => "complete", cache, () => now)).toBe("complete");
    now += 5_000;
    await expect(withLastGoodRead("brief", async () => { throw new Error("database down"); }, cache, () => now)).resolves.toBe("complete");
  });

  it("rethrows after the recovery value expires", async () => {
    const cache = new Map<string, LastGoodValue<string>>();
    let now = 1_000;
    await withLastGoodRead("brief", async () => "complete", cache, () => now);
    now += LAST_GOOD_READ_TTL_MS + 1;
    await expect(withLastGoodRead("brief", async () => { throw new Error("database down"); }, cache, () => now)).rejects.toThrow("database down");
  });
});
