/**
 * Historical package fixture only. Live legacy composition is retired.
 * Source collection remains in the application's evidence-only ingestion path.
 */
import { externalBriefingPackageSchema } from "@/server/contracts/external-briefing";
import { assemblePackage } from "./external-briefing/assemble";
import { fixtureCollectedItems, fixtureDraftOutput } from "./external-briefing/fixture";

if (!process.argv.slice(2).includes("--fixture")) {
  console.error("Legacy editorial composition is retired. Deliver new editorial work through the ChatGPT whole-site update path. Only --fixture is supported for historical compatibility.");
  process.exitCode = 1;
} else {
  const pkg = assemblePackage(fixtureCollectedItems(), fixtureDraftOutput(), "historical-fixture");
  const parsed = externalBriefingPackageSchema.safeParse(pkg);
  if (!parsed.success) {
    console.error("Historical fixture failed contract validation.");
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(parsed.data, null, 2));
  }
}
