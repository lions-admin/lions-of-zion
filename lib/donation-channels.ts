/**
 * The two places a reader can send money, and the one rule that binds them.
 *
 * Both are links to the provider's own page. No provider script runs on any
 * page of this site by default: PayPal's hosted-button SDK loads only after
 * an explicit press inside `PayPalDonateStep` (SUPPORT-003), and Buy Me a
 * Coffee's button script and floating widget are never loaded at all. The
 * plain profile URL opens exactly the page those scripts open, needs no
 * `script-src` entry in `next.config.ts`, has no failure state to design,
 * cannot have its popup blocked, works with scripting off, and cannot float a
 * third-party control over the cover. See `.ai/DECISIONS.md`, 2026-09-07.
 *
 * `lib/` is the right home: the homepage (a server component) and the support
 * page both read these, and neither should import a client component for a
 * constant.
 */

/** PayPal hosted button, as configured in the PayPal dashboard. */
export const PAYPAL_HOSTED_BUTTON_ID = "PZPE4USUV3W7E";

/** The same hosted button, opened directly on PayPal's site. Works with no scripting at all. */
export const PAYPAL_DIRECT_URL = `https://www.paypal.com/ncp/payment/${PAYPAL_HOSTED_BUTTON_ID}`;

/** The Buy Me a Coffee profile. */
export const BUY_ME_A_COFFEE_SLUG = "danielhanukayeb";
export const BUY_ME_A_COFFEE_URL = `https://www.buymeacoffee.com/${BUY_ME_A_COFFEE_SLUG}`;

export type DonationChannelId = "paypal" | "buymeacoffee";

export interface DonationChannel {
  id: DonationChannelId;
  /** The provider, named plainly, for the accessible name and the external step. */
  provider: string;
  /** The control's label, as the reader reads it. */
  label: string;
  /** Where the money actually goes: the provider's own page. */
  href: string;
  /** One line under the label: what kind of gift, and whose site takes it. */
  note: string;
}

/**
 * In the order they are offered. PayPal first: it is the channel the
 * nonprofit's receipts are issued through (`.ai/DECISIONS.md`, 2026-08-27),
 * and the one `/support-us` spends its gold control on.
 */
export const DONATION_CHANNELS: readonly DonationChannel[] = [
  {
    id: "paypal",
    provider: "PayPal",
    label: "Donate with PayPal",
    href: PAYPAL_DIRECT_URL,
    note: "A one-off gift, taken on PayPal’s own page.",
  },
  {
    id: "buymeacoffee",
    provider: "Buy Me a Coffee",
    label: "Buy the desk a coffee",
    href: BUY_ME_A_COFFEE_URL,
    note: "One-off or monthly, taken on Buy Me a Coffee’s own page.",
  },
] as const;
