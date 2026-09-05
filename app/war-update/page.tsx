import { permanentRedirect } from "next/navigation";

/** The standalone desk is retired. Existing article URLs and data are kept. */
export default function WarUpdateRedirect() {
  permanentRedirect("/geopolitical-brief");
}
