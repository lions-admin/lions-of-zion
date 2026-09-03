import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The /support-us composition (SUPPORT-001, SUPPORT-003).
 *
 * These are source assertions rather than rendered ones: `tests/` runs in a
 * node environment with no DOM, so a component cannot be mounted here. What
 * they pin is the handful of invariants whose breakage is silent — a chooser
 * that hides every flow from a reader with scripting off, a second share
 * control growing back, a payment path that depends on a third-party script
 * with no way through when it fails.
 */
const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

describe("the support chooser (SUPPORT-001)", () => {
  const page = read("app/support-us/page.tsx");
  const swtch = read("components/support/SupportFlowSwitch.tsx");

  it("offers exactly the four acts, and spends its one gold on report", () => {
    for (const id of ["report", "volunteer", "share", "donate"]) {
      expect(page, `/support-us must offer the "${id}" flow`).toContain(`id: "${id}"`);
    }
    /* One primary action per state: the chooser is a state, and exactly one
       of its four choices may be gold. `/corrections` sends readers here to
       report a claim, which is what makes report the one. */
    expect(page.match(/emphasis: "primary"/g)?.length).toBe(1);
  });

  it("reveals every flow when scripting is off", () => {
    /* The chooser is four `<button>`s and does nothing without JavaScript, so
       the no-JS tier must be handed the panels directly. An author rule on
       `[hidden]` is what outranks the UA stylesheet's `display: none`. */
    const noscript = swtch.slice(swtch.indexOf("<noscript>"), swtch.indexOf("</noscript>"));
    expect(noscript).toContain("[hidden] { display: block; }");
    expect(noscript).toContain("${styles.chooser} { display: none; }");
  });

  it("keeps every panel mounted so a change of mind loses nothing", () => {
    /* The acceptance criterion is that back/change preserves entered data.
       Hiding the inactive panels is what preserves it; rendering only the
       active one would unmount two half-filled forms. */
    expect(swtch).toContain("hidden={active !== flow.id}");
    expect(swtch).not.toMatch(/flows\.find\(|active \?\? |\.filter\(\(flow\)/);
  });

  it("lands a reader sent to /support-us#report on the report flow", () => {
    expect(read("app/corrections/page.tsx")).toContain("/support-us#report");
    expect(swtch).toContain("hashchange");
  });
});

describe("share and payment (SUPPORT-003)", () => {
  it("leaves one share control in components/support", () => {
    const shareFiles = readdirSync(path.join(ROOT, "components/support")).filter((name) =>
      /^Share.*\.tsx$/.test(name),
    );
    expect(
      shareFiles,
      "components/support must hold exactly one share control; ShareRecord in " +
        "components/archive is the remaining caller to migrate onto it.",
    ).toEqual(["ShareControls.tsx"]);
  });

  it("announces a copied link and hands over the URL when it cannot copy", () => {
    const source = read("components/support/ShareControls.tsx");
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("Copied");
    /* The failure branch must expose the link itself — a control that did
       nothing and said nothing is the defect this replaced. */
    expect(source).toMatch(/state === 'failed'[\s\S]{0,400}href=\{url\}/);
  });

  it("puts PayPal behind an explicit external step with a direct link", () => {
    const source = read("components/support/PayPalDonateStep.tsx");
    /* No third-party script may run before the reader has chosen to leave. */
    expect(source).toMatch(/step !== "loading"\) return/);
    expect(source).toContain('onClick={() => setStep("loading")}');
    expect(source).toContain("External step · PayPal");
    /* A hosted button opens a popup, and a blocked popup is a failure the
       page is never told about, so the direct link is unconditional. */
    expect(source).toContain("PAYPAL_DIRECT_URL");
    expect(source).toContain("<noscript>");
  });
});
