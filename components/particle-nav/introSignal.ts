/**
 * Whether a click belongs to the user or to the handoff.
 *
 * WebKit hit-tests a tap at `touchend`, against whatever is live at that
 * moment — not against what was under the finger when it went down. So the
 * navigation appearing under a finger that is already resting on the screen is
 * enough to activate a link nobody chose, and the largest link on a phone is a
 * full-width card to the Geopolitical Brief.
 *
 * The test is the gesture's start, not the click's time: a click is the user's
 * choice only if the gesture that produced it began after the navigation was
 * both visible and interactive.
 *
 * @param gestureStartedAt when the pointer went down / the key went down, or 0
 * @param navLiveAt        when the navigation became interactive, or 0 if this
 *                         route never ran an intro and nothing needs guarding
 */
export function shouldSwallowClick(gestureStartedAt: number, navLiveAt: number): boolean {
  if (!navLiveAt) return false;
  return gestureStartedAt <= navLiveAt;
}
