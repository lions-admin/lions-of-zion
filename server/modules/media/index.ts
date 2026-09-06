import "server-only";

/**
 * The media module's public face.
 *
 * Smaller than the other modules' because the work splits cleanly in two and
 * neither half wants a service object bound to a connection: `repo.ts` is
 * always used against a caller's own transaction (the publish transaction, or
 * a read path's connection), and `materializeExternalMedia` never touches the
 * database at all. `media()` exists for the read paths that just want the
 * repository against the pool.
 */

import { db } from "@/server/db/client";
import { mediaRepo } from "./repo";

export const media = () => mediaRepo(db());

export { mediaRepo, toEditorialMedia, heroMediaFor, type EditorialMediaDraft } from "./repo";
export { materializeExternalMedia, type MaterializeContext } from "./service";
