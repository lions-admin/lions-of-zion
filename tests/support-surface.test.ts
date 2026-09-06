import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUY_ME_A_COFFEE_URL,
  DONATION_CHANNELS,
  PAYPAL_DIRECT_URL,
} from "@/lib/donation-channels";

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

describe("donation channels are links to the provider, never embedded widgets", () => {
  /* Both providers ship a script — PayPal's hosted-button SDK, Buy Me a
     Coffee's button and floating widget. The rule (`.ai/DECISIONS.md`,
     2026-09-07) is that money never depends on one: PayPal's loads only after
     an explicit press, and Buy Me a Coffee's never loads at all, because the
     profile URL opens the same page. These pin that no page quietly grows a
     third-party script back. */
  const SOURCE_ROOTS = ["app", "components", "lib"];
  const listSources = (dir: string): string[] =>
    readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) return listSources(rel);
      return /\.(ts|tsx|css)$/.test(entry.name) ? [rel] : [];
    });

  it("names both providers by their own URL, PayPal first", () => {
    expect(new URL(PAYPAL_DIRECT_URL).hostname).toBe("www.paypal.com");
    expect(new URL(BUY_ME_A_COFFEE_URL).hostname).toBe("www.buymeacoffee.com");
    expect(DONATION_CHANNELS.map((channel) => channel.href)).toEqual([
      PAYPAL_DIRECT_URL,
      BUY_ME_A_COFFEE_URL,
    ]);
    for (const channel of DONATION_CHANNELS) {
      expect(channel.label.length, `${channel.id} needs a label`).toBeGreaterThan(0);
      expect(channel.note, `${channel.id} must say whose page takes the payment`).toContain(
        channel.provider,
      );
    }
  });

  it("never loads Buy Me a Coffee's button or widget script anywhere", () => {
    const offenders = SOURCE_ROOTS.flatMap(listSources).filter((rel) =>
      /cdnjs\.buymeacoffee\.com|BMC-Widget|bmc-button|widget\.prod\.min\.js/.test(read(rel)),
    );
    expect(offenders).toEqual([]);
    /* And the CSP has not been widened to let one in. */
    expect(read("next.config.ts")).not.toContain("buymeacoffee");
  });

  it("offers both channels on /support-us, with PayPal keeping the one gold control", () => {
    const page = read("app/support-us/page.tsx");
    expect(page).toContain("<PayPalDonateStep />");
    expect(page).toContain("<BuyMeACoffeeStep />");
    expect(page.indexOf("<PayPalDonateStep />")).toBeLessThan(page.indexOf("<BuyMeACoffeeStep />"));
    const step = read("components/support/BuyMeACoffeeStep.tsx");
    expect(step).toContain("BUY_ME_A_COFFEE_URL");
    expect(step).toContain('variant="secondary"');
    expect(step).toContain('rel="noreferrer"');
    expect(step).not.toContain("<script");
  });

  it("closes the homepage on the same two links and names the band in the contents line", () => {
    const journey = read("components/home/HomepageJourney.tsx");
    expect(journey).toContain("<HomeSupportSection />");
    expect(journey).toContain('href="#home-support"');
    const section = read("components/home/HomeSupportSection.tsx");
    expect(section).toContain("DONATION_CHANNELS");
    expect(section).toContain('id="home-support"');
    expect(section).toContain('rel="noreferrer"');
    expect(section).toContain('href="/support-us"');
    expect(section).not.toContain("<script");
    expect(section).not.toContain("use client");
  });
});
