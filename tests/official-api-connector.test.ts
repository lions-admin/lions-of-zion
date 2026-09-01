import { describe, expect, it } from "vitest";
import { parseOfficialApiResults } from "@/server/modules/sources/connectors/api";

describe("official JSON API connector", () => {
  it("maps configured public records without retaining provider prose", () => {
    const items = parseOfficialApiResults({ data: [{
      uuid: "brief-1",
      headline: "Official situation update",
      canonical: "https://gov.example.il/update/1",
      lead: "A source-provided summary.",
      published: "2026-08-30T07:00:00Z",
    }] }, {
      itemsPath: "data",
      idPath: "uuid",
      titlePath: "headline",
      urlPath: "canonical",
      excerptPath: "lead",
      publishedAtPath: "published",
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      externalId: "brief-1",
      title: "Official situation update",
      url: "https://gov.example.il/update/1",
      excerpt: "A source-provided summary.",
    });
  });

  it("rejects records without a direct HTTP publisher URL", () => {
    expect(parseOfficialApiResults({ items: [{ title: "No link", url: "javascript:bad" }] })).toEqual([]);
  });

  it("builds safe canonical links from an official data record template", () => {
    expect(parseOfficialApiResults({ result: { results: [{ name: "shelters-br7", title: "מקלטים בעיר באר שבע" }] } }, {
      itemsPath: "result.results",
      idPath: "name",
      titlePath: "title",
      urlTemplate: "https://data.gov.il/dataset/{name}",
    })).toMatchObject([{ externalId: "shelters-br7", url: "https://data.gov.il/dataset/shelters-br7" }]);
  });

  it("rejects a template when its record key is missing", () => {
    expect(parseOfficialApiResults({ result: { results: [{ title: "מקלטים" }] } }, {
      itemsPath: "result.results",
      titlePath: "title",
      urlTemplate: "https://data.gov.il/dataset/{name}",
    })).toEqual([]);
  });
});
