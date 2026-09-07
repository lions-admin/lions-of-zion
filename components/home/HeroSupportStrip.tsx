import { DONATION_CHANNELS, type DonationChannelId } from "@/lib/donation-channels";
import styles from "@/app/home.module.css";

const COMPACT_LABEL: Record<DonationChannelId, string> = {
  paypal: "PayPal",
  buymeacoffee: "Buy a coffee",
};

/** Direct provider links, grouped as one quiet support invitation on the cover. */
export function HeroSupportStrip() {
  return (
    <nav className={styles.supportStrip} aria-label="Sustain the work">
      <span className={styles.supportLabel}>Support the desk</span>
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
