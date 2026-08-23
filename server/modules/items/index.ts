import "server-only";

/**
 * The module's public face.
 *
 * It binds its own database connection, so a route handler never sees one.
 * That is not ceremony: the lint rule refusing `@/server/db` inside
 * `app/api/**` caught this file handing the connection outward in its first
 * draft, which is exactly how persistence starts leaking into transport.
 */

import { db } from "@/server/db/client";
import { itemService, type ItemService } from "./service";

let bound: ItemService | undefined;

/** Lazily bound, so importing this module does not demand a DATABASE_URL. */
export const items = (): ItemService => (bound ??= itemService(db()));

/** For tests, which supply their own PGlite database. */
export { itemService, type ItemService } from "./service";
