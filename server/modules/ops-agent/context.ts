import "server-only";

/**
 * What the agent is allowed to reach.
 *
 * The tools are defined against this interface rather than against the module
 * indexes directly, and that is the whole security posture of this module in
 * one sentence: the model has no database handle, no `process.env`, no fetch,
 * and no way to compose a new capability out of the ones listed here. Adding
 * a power to the assistant means adding a method here and a tool that calls
 * it — there is no path that skips both.
 *
 * It is also what makes the agent testable without a gateway: a test supplies
 * a stub context and asserts on what the loop did.
 */

import type { Actor } from "@/server/core/audit";
import type {
  AuditEntry,
  AuditPage,
  ConsoleCosts,
  ConsoleEditionDrilldown,
  ConsoleEditorial,
  ConsoleIncidents,
  ConsoleNarratives,
  ConsoleOverview,
  ConsolePipeline,
  ConsoleQualityChecks,
  ConsoleSecurity,
  ConsoleSettings,
  ConsoleSourceFetches,
  ConsoleSources,
  ConsoleUsers,
  ListAudit,
  ListEditionDrilldown,
  ListQualityChecks,
  ListSourceFetches,
  PublicationVersion,
  ResolveAlert,
  RollbackPublication,
  SetSourceActive,
  ConsoleAlert,
} from "@/server/contracts/admin-console";
import type {
  ListPublications,
  TransitionPublication,
  UpdatePublication,
} from "@/server/contracts/publication";

/** The console's read model and recovery actions, as the agent sees them. */
export interface ConsoleReads {
  overview(): Promise<ConsoleOverview>;
  pipeline(): Promise<ConsolePipeline>;
  sources(): Promise<ConsoleSources>;
  editorial(): Promise<ConsoleEditorial>;
  narratives(): Promise<ConsoleNarratives>;
  users(): Promise<ConsoleUsers>;
  costs(): Promise<ConsoleCosts>;
  incidents(): Promise<ConsoleIncidents>;
  qualityChecks(input: ListQualityChecks): Promise<ConsoleQualityChecks>;
  editionDrilldown(input: ListEditionDrilldown): Promise<ConsoleEditionDrilldown>;
  sourceFetches(input: ListSourceFetches): Promise<ConsoleSourceFetches>;
  security(request?: Request): Promise<ConsoleSecurity>;
  settings(): Promise<ConsoleSettings>;
  audit(input: ListAudit): Promise<AuditPage>;
  auditEntry(id: string): Promise<AuditEntry>;
  resolveAlert(id: string, input: ResolveAlert, actor: Actor, requestId?: string): Promise<ConsoleAlert>;
  setSourceActive(id: string, input: SetSourceActive, actor: Actor, requestId?: string): Promise<{ id: string; active: boolean }>;
  publicationVersions(id: string): Promise<PublicationVersion[]>;
  rollbackPublication(id: string, input: RollbackPublication, actor: Actor, requestId?: string): Promise<unknown>;
}

/** Publications, narrowed to what the desk needs. */
export interface PublicationOps {
  get(id: string): Promise<unknown>;
  list(filters: ListPublications): Promise<unknown[]>;
  update(id: string, input: UpdatePublication, actor: Actor, requestId?: string): Promise<unknown>;
  remove(id: string, actor: Actor, requestId?: string): Promise<void>;
  transition(id: string, input: TransitionPublication, actor: Actor, requestId?: string): Promise<unknown>;
  setHomepagePlacement(area: "news" | "fakeResistance" | "people", position: "lead" | "secondary", publicationId: string | null, actor: Actor): Promise<void>;
}

/** Source collection. */
export interface SourceOps {
  verify(sourceId: string, actor: Actor): Promise<unknown>;
  syncCatalog(actor: Actor): Promise<{ created: number; updated: number }>;
}

export interface OpsToolContext {
  console: ConsoleReads;
  publications: PublicationOps;
  sources: SourceOps;
  health(request?: Request): Promise<unknown>;
  /** The request being served, for the reads that vary by it. */
  request?: Request;
}
