import "server-only";

import { db } from "@/server/db/client";
import { evidenceService, type EvidenceService } from "./service";

/** Lazily bound, so importing this module does not demand a DATABASE_URL. */
export const evidenceItems = (): EvidenceService => evidenceService(db());

export {
  evidenceService,
  createEvidenceInTx,
  findEvidenceByExternalId,
  type EvidenceService,
} from "./service";
