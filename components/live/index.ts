/**
 * The updates feed.
 *
 * Server components throughout apart from the `Reveal` wrappers the feed uses
 * for its day groups, so `/updates` renders complete with JavaScript off —
 * including its section filters and its cursor paging, which are links.
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
