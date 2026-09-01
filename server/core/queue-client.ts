import "server-only";

import { QueueClient, type VercelRegion } from "@vercel/queue";
import { queueRegion } from "./config";

/** Explicitly configurable so the queue can be colocated with Functions and
 * Postgres rather than silently assuming one region forever. */
export const queueClient = new QueueClient({ region: queueRegion() as VercelRegion });
