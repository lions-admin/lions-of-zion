/**
 * The investigation surface — one case, read as a thread through an
 * information system.
 *
 * Server components: `CaseStoryHeader`, `UnknownsPanel`. Everything else is a
 * client island that reads the shared selection from `InvestigationProvider`;
 * the provider takes server-rendered children, so a page built from these
 * stays a server component with prose, sources and unknowns prerendered.
 */
export { InvestigationProvider, useInvestigation } from './InvestigationProvider';
export { EvidencePath } from './EvidencePath';
export { InvestigationSectionNav, type InvestigationSection } from './InvestigationSectionNav';
export { CaseStoryHeader } from './CaseStoryHeader';
export { RoleMap } from './RoleMap';
export { NarrativeLanes } from './NarrativeLanes';
export { RelationshipFlow } from './RelationshipFlow';
export { InvestigationTimeline } from './InvestigationTimeline';
export { EvidenceLedger } from './EvidenceLedger';
export { EntityInspector } from './EntityInspector';
export { UnknownsPanel } from './UnknownsPanel';
export { NetworkExplorer, type NetworkCaseLink } from './NetworkExplorer';
