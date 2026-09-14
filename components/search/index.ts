/**
 * Search.
 *
 * `SearchLauncher` is the entry point, and is exported for Wave B to mount in
 * the site header — this wave does not touch `components/site/**`. Everything
 * else is here for `/search`.
 */

export { SearchLauncher } from "./SearchLauncher";
export type { SearchLauncherProps } from "./SearchLauncher";
export { SearchDialog } from "./SearchDialog";
export { SearchPanel } from "./SearchPanel";
export type { SearchPanelProps } from "./SearchPanel";
export { SearchPageView } from "./SearchPageView";
export type { SearchPageViewProps } from "./SearchPageView";
export { SearchFilters } from "./SearchFilters";
export { SearchPager } from "./SearchPager";
export { entityLabel, entityLabelPlural, groupByEntity, resultStatus } from "./vocabulary";
export type { ResultRange, ResultStatus } from "./vocabulary";
