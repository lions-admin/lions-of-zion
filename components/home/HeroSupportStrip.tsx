import { Icon, type IconName } from "@/components/ui/Icon";
import { DONATION_CHANNELS, type DonationChannelId } from "@/lib/donation-channels";
import styles from "@/app/home.module.css";

const CHANNEL_ICON: Record<DonationChannelId, IconName> = {
  paypal: "support",
  buymeacoffee: "coffee",
};

/**
 * The ask, on the cover — owner ruling, 2026-09-07 (`.ai/DECISIONS.md`).
 *
 * The same two links as the closing band, as compact chips under the cover's
 * reading paths. They borrow the home chrome's own geometry rather than
 * inventing one: the header's *Support Us* control is a 3px-radius hairline
 * at 13px in the navigation face, and so are these — gold-lined, so they read
 * as the one warm thing under the cover copy without taking the arrow that
 * belongs to *Read the latest*.
 *
 * The moment. They are not on screen when the cover paints: each chip rises
 * into place after the cover has been read, its hairline flashes to gold
 * once, and then it holds still. That is the whole of the motion — one idea,
 * sequenced, over by two seconds — and it moves only opacity, transform and
 * colour, so the strip owns its space from first paint and shifts nothing
 * below it. `prefers-reduced-motion` gets the chips static and present.
 *
 * Not a toast and not a floating widget: an ask that disappears cannot be
 * acted on, and the cover has no floating controls. On a phone the header
 * hides its *Support Us* control, so there this strip is the cover's only
 * support affordance.
 *
 * A server component: the links are in the prerendered HTML and the motion
 * is CSS, so nothing here depends on hydration or on a script.
 */
export function HeroSupportStrip() {
  return (
    <nav className={styles.supportStrip} aria-label="Sustain the work">
      <ul className={styles.supportList}>
        {DONATION_CHANNELS.map((channel) => (
          <li key={channel.id}>
            <a
              className={styles.supportChip}
              href={channel.href}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name={CHANNEL_ICON[channel.id]} size={15} strokeWidth={1.5} />
              <span>{channel.label}</span>
              <span className={styles.supportChipArrow} aria-hidden="true">↗︎</span>
              <span className="srOnly"> (opens {channel.provider} in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
