import "server-only";

import { db } from "@/server/db/client";
import { opsToolContext } from "@/server/modules/ops-agent";
import { chatgptAutomationService, type ChatgptAutomationService } from "./service";

/** Lazily bound, so importing this module does not demand a DATABASE_URL. */
export const chatgptAutomation = (request?: Request): ChatgptAutomationService =>
  chatgptAutomationService(db(), opsToolContext(request));

export { chatgptAutomationService, type ChatgptAutomationService } from "./service";
