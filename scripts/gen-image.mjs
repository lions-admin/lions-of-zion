const MODEL = "bytedance-seed/seedream-5-0-pro";
const API_URL = "https://openrouter.ai/api/v1/images";
import fs from "node:fs";

async function gen(promptFile, outPath) {
  const prompt = fs.readFileSync(promptFile, "utf8");
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      aspect_ratio: "16:9",
      resolution: "2K",
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 400)}`);
  const result = await res.json();
  const images = result.data ?? [];
  if (!images.length || !images[0].b64_json)
    throw new Error("no image data: " + JSON.stringify(result).slice(0, 300));
  fs.writeFileSync(outPath, Buffer.from(images[0].b64_json, "base64"));
  const u = result.usage;
  console.log(`saved ${outPath} | cost: $${u?.cost ?? "?"} | tokens: ${u?.total_tokens ?? "?"}`);
}

const [promptFile, outPath] = process.argv.slice(2);
await gen(promptFile, outPath);
