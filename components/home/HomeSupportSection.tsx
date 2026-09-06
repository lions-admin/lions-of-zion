import { Icon, type IconName } from "@/components/ui/Icon";
import { DONATION_CHANNELS, type DonationChannelId } from "@/lib/donation-channels";
import { JourneyLink } from "./HomeJourneyPrimitives";
import styles from "./homepage-journey.module.css";

const CHANNEL_ICON: Record<DonationChannelId, IconName> = {
  paypal: "support",
  buymeacoffee: "coffee",
};

/**
 * The edition's close: the ask.
 *
 * It comes last on purpose. The homepage is a journey from what is happening
 * now to how the system works, and a reader who has followed it that far has
 * seen what the money pays for; an ask before the first story would be a
 * paywall's posture on a site that has none. The header's *Support Us* is the
 * permanent way in from anywhere on the page, and the edition's contents line
 * names this band so it is one tap from the top.
 *
 * Two channels, both plain links to the provider's own page, drawn in the
 * journey's outlined-gold control — the same one `AmplificationFigure` uses to
 * trace a claim — rather than in either provider's branding. No provider
 * script runs on the cover, and no floating widget sits over the lion: see
 * `lib/donation-channels.ts` for why.
 */
export function HomeSupportSection() {
  return (
    <section
      id="home-support"
      className={`${styles.section} ${styles.support}`}
      aria-labelledby="home-support-title"
      data-home-section="support"
    >
      <div className={styles.supportHead}>
        <div>
          <p className={styles.kicker}>Sustain the work</p>
          <h2 id="home-support-title">Keep the desk running.</h2>
        </div>
        <p>
          Monitoring, archiving, verification tooling and the infrastructure
          under every record carry real costs, and reader donations are what
          pay them. Each gift is taken on the provider’s own page; no card
          detail is ever typed here.
        </p>
      </div>
      <ul className={styles.supportChannels} aria-label="Ways to donate">
        {DONATION_CHANNELS.map((channel) => (
          <li key={channel.id}>
            <a
              className={styles.supportChannel}
              href={channel.href}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name={CHANNEL_ICON[channel.id]} size={22} strokeWidth={1.4} />
              <span className={styles.supportChannelLabel}>{channel.label}</span>
              <span className={styles.supportChannelNote}>{channel.note}</span>
              <span className={styles.supportChannelArrow} aria-hidden="true">↗︎</span>
              <span className="srOnly"> (opens {channel.provider} in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
      <p className={styles.supportMore}>
        <JourneyLink href="/support-us">
          Other ways to help: report a claim, volunteer a skill, share what is verified
        </JourneyLink>
      </p>
    </section>
  );
}
