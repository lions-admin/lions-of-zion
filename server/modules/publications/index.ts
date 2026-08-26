import "server-only";

import { db } from "@/server/db/client";
import { publicationService, type PublicationService } from "./service";

export const publications = (): PublicationService => publicationService(db());

export { publicationService, type PublicationService } from "./service";
