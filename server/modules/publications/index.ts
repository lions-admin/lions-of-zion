import "server-only";

import { db } from "@/server/db/client";
import { publicationService, type PublicationService } from "./service";

let bound: PublicationService | undefined;

export const publications = (): PublicationService => (bound ??= publicationService(db()));

export { publicationService, type PublicationService } from "./service";
