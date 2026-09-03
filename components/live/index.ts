/**
 * The updates feed.
 *
 * Server components throughout. `/updates` renders complete with JavaScript
 * off — including its section filters and its cursor paging, which are links.
 * Day groups are plain sections, not `Reveal` wrappers, so rows are in the
 * HTML at opacity 1.
 */

export { UpdateFeed, UPDATES_PATH } from "./UpdateFeed";
export type { UpdateFeedProps } from "./UpdateFeed";
export { UpdateEntry } from "./UpdateEntry";
export { FeedStatus } from "./FeedStatus";
export {
  SECTION_LABELS,
  TREND_LABELS,
  VERIFICATION_STATES,
} from "./publication-labels";
export {
  FEED_REVALIDATE_SECONDS,
  clock,
  dayKey,
  dayLabel,
  groupByDay,
  stamp,
} from "./feed-time";
export type { DayGroup } from "./feed-time";
