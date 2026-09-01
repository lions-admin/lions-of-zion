import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/server/http/responses";

const mocks = vi.hoisted(() => ({
  getPublicPublication: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("@/lib/publications", () => ({
  getPublicPublication: mocks.getPublicPublication,
  isMissingPublication: (cause: unknown) => cause instanceof ApiError && cause.code === "NOT_FOUND",
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

import ArticlePage, { generateMetadata } from "@/app/articles/[publicId]/page";

describe("public article error boundary", () => {
  beforeEach(() => {
    mocks.getPublicPublication.mockReset();
    mocks.notFound.mockClear();
  });

  it("renders a missing public article as a 404", async () => {
    mocks.getPublicPublication.mockRejectedValueOnce(new ApiError("NOT_FOUND", "Publication was not found"));

    await expect(ArticlePage({ params: Promise.resolve({ publicId: "missing" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it("does not mask an infrastructure failure as a 404", async () => {
    mocks.getPublicPublication.mockRejectedValueOnce(new Error("database temporarily unavailable"));

    await expect(ArticlePage({ params: Promise.resolve({ publicId: "existing" }) })).rejects.toThrow("database temporarily unavailable");
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("keeps infrastructure failures visible while metadata is generated", async () => {
    mocks.getPublicPublication.mockRejectedValueOnce(new Error("database temporarily unavailable"));

    await expect(generateMetadata({ params: Promise.resolve({ publicId: "existing" }) })).rejects.toThrow("database temporarily unavailable");
  });
});
