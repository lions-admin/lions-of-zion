import "server-only";

import { QueueClient } from "@vercel/queue";

/** RSS, Functions and Neon all live in iad1; keep queue delivery there too. */
export const queueClient = new QueueClient({ region: "iad1" });
