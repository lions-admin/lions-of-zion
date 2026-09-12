import { DONATION_CHANNELS, type DonationChannelId } from "@/lib/donation-channels";
import styles from "./homepage-journey.module.css";

const COMPACT_LABEL: Record<DonationChannelId, string> = {
  paypal: "PayPal",
  buymeacoffee: "Buy a coffee",
};

/**
 * Direct provider links as one rail of gold-outlined chips at the close of the
 * first band — after the news, before the narratives. The chips were a slim
 * line of underlined 13px text until the owner's ruling of 2026-09-11 asked
 * for donations to be prominent; they now draw the header's Support control.
 *
 * It was the cover's last block (owner ruling, 2026-09-07) and it cost the
 * phone cover 44px plus its margin before a single story had been read. The
 * owner's amendment to UX-13 moved it rather than removing it: the reader has
 * seen the lead and its companion by the time this rail arrives, which is
 * what "after the reader has seen what it pays for" asks. The links stay
 * plain provider URLs, take no arrow of their own — the external glyph is the
 * chrome's mark for leaving — and load no script; `lib/donation-channels.ts`
 * carries that reasoning. `HomeSupportSection` is still the edition's close
 * and the header's *Support Us* is still the way in from anywhere.
 */
export function HeroSupportStrip() {
  return (
    <nav className={styles.supportStrip} aria-label="Support the work">
      <span className={styles.supportLabel}>Support the work</span>
      <ul className={styles.supportList}>
        {DONATION_CHANNELS.map((channel) => (
          <li key={channel.id}>
            <a
              className={styles.supportChip}
              href={channel.href}
              target="_blank"
              rel="noreferrer"
            >
              <span>{COMPACT_LABEL[channel.id]}</span>
              <span className={styles.supportChipArrow} aria-hidden="true">↗︎</span>
              <span className="srOnly"> (opens {channel.provider} in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
