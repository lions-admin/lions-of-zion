import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomeSystemSection } from "@/components/home/HomeSystemSection";

const read = (file: string) => readFileSync(file, "utf8");

/**
 * VA-21 — the homepage system band is one proof of method, and everything it
 * used to carry is somewhere a reader can still reach.
 *
 * Measured at 375px on 2026-09-07: the band was 3,517px of a 12,047px page
 * (29.2%) and is now 1,428px of a 9,958px page (14.3%). These tests pin the
 * shape rather than the pixels — a second walkthrough, a third link or a
 * second interaction is what would put the length back.
 */
describe("homepage system band — one proof, one interaction, two links", () => {
  const html = renderToStaticMarkup(<HomeSystemSection />);

  it("makes the source-counting test the band's whole argument", () => {
    expect(html).toContain("More copies.");
    expect(html).toContain("Not more evidence.");
    /* The one interaction: the trace toggle inside `AmplificationFigure`. */
    expect(html.match(/aria-pressed=/g)).toHaveLength(1);
    expect(html).toContain("Trace the sources");
  });

  it("offers exactly two links — How it works and Methodology", () => {
    const hrefs = [...html.matchAll(/<a[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(["/information-war", "/methodology"]);
  });

  it("no longer runs a second product below the edition", () => {
    /* The five-stage walkthrough… */
    for (const gone of [
      "Fictional walkthrough",
      "Detect the spread",
      "Investigation stages",
      /* …the two branch explanations… */
      "Reporting you can trace",
      "Testimony kept intact",
      "Explore the archive",
      /* …and the second copy of the lesson the figure itself makes. */
      "Why the source matters",
    ]) {
      expect(html, gone).not.toContain(gone);
    }
  });

  it("keeps the provenance distinction the homepage is the only place to meet", () => {
    expect(html).toContain("different provenance and review paths");
  });

  it("relocates the walkthrough to How it works rather than deleting it", () => {
    const band = read("components/home/HomeSystemSection.tsx");
    const howItWorks = read("components/briefs/InformationWarSystem.tsx");
    expect(band).not.toContain("HomeEvidencePipeline");
    expect(howItWorks).toContain("HomeEvidencePipeline");
    expect(howItWorks).toContain('id="walkthrough"');
    /* The walkthrough's own file is untouched: it is the same component, in a
       new place, so its reduced-motion contract moves with it. */
    const walkthrough = read("components/home/HomeEvidencePipeline.tsx");
    expect(walkthrough).toContain("prefers-reduced-motion: reduce");
    expect(walkthrough).toContain("disabled={reduced}");
  });

  it("reserves the annotation line so the one interaction cannot shift the page", () => {
    /* Measured: the figure is 884px at 375 in both states. The reservation is
       what makes that true — drop it and the trace toggle moves everything
       below it. */
    const css = read("components/home/homepage-journey.module.css");
    expect(css).toMatch(/\.echoAnnotation \{[^}]*min-height: 3\.2em/);
    expect(css).toMatch(/\.echoAnnotation \{ min-height: 3\.4em; \}/);
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("keeps every phone type size on or above the contract's floors", () => {
    const css = read("components/home/homepage-journey.module.css");
    /* The 12px caption and the 11px principle the band used to set below the
       13px floor are gone; nothing under 759px reintroduces them. */
    const phone = css.slice(css.indexOf("@media (max-width: 759px)"));
    expect(phone).not.toMatch(/\.echoAnnotation \{[^}]*font-size: 12px/);
    expect(phone).not.toMatch(/\.echoPrinciple \{[^}]*font-size: 11px/);
    expect(css).toMatch(/\.echoPrinciple \{[^}]*13px/);
    expect(css).toMatch(/\.amplification figcaption \{[^}]*font-size: 13px/);
  });
});
