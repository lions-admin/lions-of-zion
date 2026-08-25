import type { Metadata } from "next";
import { GeopoliticalBrief } from "@/components/briefs/GeopoliticalBrief";

const TAGLINE =
  "The daily strategic picture: verified developments, their context, and what they change.";

export const metadata: Metadata = {
  title: "Geopolitical Brief",
  description: TAGLINE,
};

export default function Page() {
  return <GeopoliticalBrief />;
}
