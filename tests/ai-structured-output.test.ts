import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseStructuredJson } from "@/server/core/ai/gateway";

describe("structured model output", () => {
  const schema = z.object({ title: z.string().min(1), evidenceIds: z.array(z.uuid()).min(1) });

  it("accepts only JSON that satisfies the supplied schema", () => {
    expect(parseStructuredJson(schema, JSON.stringify({
      title: "Verified update",
      evidenceIds: ["4cfb5485-afe9-464a-ad48-26a41f754052"],
    }), "stop", undefined)).toEqual({
      title: "Verified update",
      evidenceIds: ["4cfb5485-afe9-464a-ad48-26a41f754052"],
    });
  });

  it("accepts one complete fenced JSON object even when the model adds wrapper prose", () => {
    const json = JSON.stringify({
      title: "Verified update",
      evidenceIds: ["4cfb5485-afe9-464a-ad48-26a41f754052"],
    });
    expect(parseStructuredJson(schema, `\`\`\`json\n${json}\n\`\`\``, "stop", undefined)).toEqual(JSON.parse(json));
    expect(parseStructuredJson(schema, `Here is the result:\n\`\`\`json\n${json}\n\`\`\``, "stop", undefined)).toEqual(JSON.parse(json));
    expect(() => parseStructuredJson(schema, `Here is the result:\n${json}`, "stop", undefined))
      .toThrow(/not valid JSON/);
  });

  it("rejects empty, malformed, and schema-invalid model output", () => {
    expect(() => parseStructuredJson(schema, "", "length", undefined)).toThrow(/empty JSON response/);
    expect(() => parseStructuredJson(schema, "not json", "stop", undefined)).toThrow(/not valid JSON/);
    expect(() => parseStructuredJson(schema, "{}", "stop", undefined)).toThrow(/structured contract/);
  });

  /* Production, 2026-09-03: the drafting model hit its output ceiling in the
     middle of the object, so the body was a syntactically open JSON prefix
     and the finish reason was `length` (provider: `max_output_tokens`). The
     error the job carried into quarantine has to name that finish reason —
     it is the only thing that distinguishes "the model ran out of room" from
     "the model wrote prose" — and a truncated object must never be repaired
     into a partial edition. */
  it("names the output-limit finish reason when the object was cut off mid-stream", () => {
    const truncated = JSON.stringify({
      title: "Verified update",
      evidenceIds: ["4cfb5485-afe9-464a-ad48-26a41f754052"],
    }).slice(0, -12);
    expect(() => parseStructuredJson(schema, truncated, "length", "max_output_tokens"))
      .toThrow(/not valid JSON \(finish: length\/max_output_tokens\)/);
    expect(() => parseStructuredJson(schema, `\`\`\`json\n${truncated}`, "length", "max_output_tokens"))
      .toThrow(/not valid JSON \(finish: length\/max_output_tokens\)/);
  });
});
