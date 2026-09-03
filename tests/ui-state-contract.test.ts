import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function css(rel: string) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

describe("interactive primitive states (STATE-001)", () => {
  it("Button ships hover, focus-visible, active, disabled, and loading", () => {
    const source = css("components/ui/button.module.css");
    expect(source).toMatch(/:hover/);
    expect(source).toMatch(/:focus-visible/);
    expect(source).toMatch(/:active/);
    expect(source).toMatch(/:disabled/);
    expect(source).toContain(".loading");
  });

  it("Field ships invalid, disabled, and focus-visible", () => {
    const source = css("components/ui/field.module.css");
    expect(source).toMatch(/\[data-invalid\]|:invalid|aria-invalid|\.error/);
    expect(source).toMatch(/\[data-disabled\]|:disabled/);
    expect(source).toMatch(/:focus-visible/);
  });

  it("Dialog ships modal and drawer variants", () => {
    const source = css("components/ui/dialog.module.css");
    expect(source).toContain(".modal");
    expect(source).toContain(".drawer");
  });
});
