import { BriefError } from 'lions-of-zion';

/**
 * The Geopolitical Brief's failure state. It says what happened, offers a
 * reload, and gives a way back to the scan — it never renders a partial brief,
 * because a half-loaded brief is indistinguishable from an edited one.
 */
export function CouldNotLoad() {
  return <BriefError />;
}
