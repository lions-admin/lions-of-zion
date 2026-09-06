import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { BUY_ME_A_COFFEE_URL } from "@/lib/donation-channels";
import styles from "./buy-me-a-coffee-step.module.css";

/**
 * The second way to give, beside the PayPal step (SUPPORT-003).
 *
 * Buy Me a Coffee ships two scripts — a branded button and a floating widget
 * that pins itself to a corner of every page. Neither is used here. The
 * profile URL opens exactly the page those scripts open, so this is a link:
 * it needs no third-party code and no `script-src` entry, it has no failure
 * state to design, and it works with scripting off. The house says whose
 * site takes the payment, in its own voice, and hands over.
 *
 * Secondary, not gold: the panel's one gold control is *Continue to PayPal*
 * above this, and a second filled button would make the reader pick between
 * two emphases instead of two providers.
 *
 * A server component with no client JavaScript, so the link is in the
 * prerendered HTML whatever the switch around it does.
 */
export function BuyMeACoffeeStep() {
  return (
    <section className={styles.step} aria-labelledby="buy-me-a-coffee-title">
      <p id="buy-me-a-coffee-title" className={styles.label}>
        Also on Buy Me a Coffee
      </p>
      <p className={styles.external}>
        A one-off coffee or a monthly one, paid on Buy Me a Coffee’s own site.
        As with PayPal, nothing about a card is typed here and this site never
        sees it.
      </p>
      <ButtonLink
        variant="secondary"
        size="md"
        href={BUY_ME_A_COFFEE_URL}
        target="_blank"
        rel="noreferrer"
        leftIcon={<Icon name="coffee" size={16} strokeWidth={1.5} />}
      >
        Buy the desk a coffee
      </ButtonLink>
    </section>
  );
}
