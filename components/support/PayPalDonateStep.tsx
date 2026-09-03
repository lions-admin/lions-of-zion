"use client";

/**
 * The donation hand-off, as an explicit external step (SUPPORT-003).
 *
 * What was here before mounted PayPal's hosted-button SDK on page load: the
 * moment /support-us rendered, a third-party script ran and a PayPal-branded
 * control appeared beside the site's own, competing with it for the one gold
 * action the page is allowed. It also had no failure state at all — if the SDK
 * did not load, the reader saw an empty 86px box and was told nothing.
 *
 * This is a step instead:
 *
 *  1. **House UI.** The site says, in its own voice, that payment happens on
 *     PayPal's site and what the money is for. One gold control: *Continue to
 *     PayPal*. No third-party script has run yet.
 *  2. **The external step.** Only after that press does the SDK load, inside a
 *     bounded region labelled as PayPal's. The house gold is spent by then, so
 *     the branded button is the only emphasis on screen and competes with
 *     nothing.
 *
 * The direct payment link is exposed in that region whatever happens — a
 * hosted button opens a popup, and a popup can be blocked, sandboxed, or
 * silently refused without the page ever learning of it. If the SDK itself
 * fails the reader is told so and handed the same link. Nothing about the
 * money path may depend on a script the site does not control.
 */
import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { assertiveLive, politeLive } from "@/components/ui/live-region";
import styles from "./paypal-step.module.css";

const PAYPAL_CLIENT_ID =
  "BAAgpvkmgagTCH_kxjOA8JfyQbZBrFmp4cRt3w2d0oqQA0DnMezirBosa311pZQvP24hSYQjqEolAcYF14";
const HOSTED_BUTTON_ID = "PZPE4USUV3W7E";

/** The same hosted button, opened directly. Works with no scripting at all. */
export const PAYPAL_DIRECT_URL = `https://www.paypal.com/ncp/payment/${HOSTED_BUTTON_ID}`;

const CONTAINER_ID = "paypal-donate-button";
const SCRIPT_ID = "paypal-hosted-buttons-sdk";
const SDK_URL = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&components=hosted-buttons&disable-funding=venmo&currency=USD`;

declare global {
  interface Window {
    paypal?: {
      HostedButtons: (options: { hostedButtonId: string }) => {
        render: (selector: string) => void;
      };
    };
  }
}

type Step = "idle" | "loading" | "ready" | "failed";

export function PayPalDonateStep() {
  const [step, setStep] = useState<Step>("idle");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step !== "loading") return;
    let cancelled = false;

    const mount = () => {
      if (cancelled) return;
      const paypal = window.paypal;
      if (!paypal || !containerRef.current) {
        setStep("failed");
        return;
      }
      try {
        paypal.HostedButtons({ hostedButtonId: HOSTED_BUTTON_ID }).render(`#${CONTAINER_ID}`);
        setStep("ready");
      } catch {
        setStep("failed");
      }
    };

    if (window.paypal) {
      mount();
      return () => {
        cancelled = true;
      };
    }

    const fail = () => {
      if (!cancelled) setStep("failed");
    };

    /* The tag may already be in the document from an earlier press: reuse it
       rather than loading the SDK twice. If it is there and has already
       finished, `window.paypal` was set and the branch above ran. */
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", mount, { once: true });
    script.addEventListener("error", fail, { once: true });
    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = SDK_URL;
      script.async = true;
      document.head.append(script);
    }

    /* A script tag that never fires either event leaves the reader watching a
       spinner forever. The direct link is behind this timeout. */
    const timeout = window.setTimeout(fail, 15_000);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      script.removeEventListener("load", mount);
      script.removeEventListener("error", fail);
    };
  }, [step]);

  return (
    <div className={styles.step}>
      {/*
        With scripting off the house control below is a `<button>` that does
        nothing, and the SDK it would load cannot run either. The whole
        scripted step is removed in that tier and replaced by the direct link,
        which is the same hosted button opened on PayPal's own site — the one
        path that needs nothing from this page. Same technique as the two forms
        on this page: a `<style>` inside `<noscript>` is how a prerendered page
        branches on whether scripting ran.
      */}
      <noscript>
        <style>{`.${styles.house} { display: none; }`}</style>
        <p className={styles.external}>
          Payment is handled by PayPal, on PayPal’s own site.
        </p>
        <ButtonLink
          variant="secondary"
          size="md"
          href={PAYPAL_DIRECT_URL}
          target="_blank"
          rel="noreferrer"
        >
          Open the PayPal payment page
        </ButtonLink>
      </noscript>

      {step === "idle" ? (
        <div className={styles.house}>
          <p className={styles.external}>
            The next step leaves this site. Payment is taken by PayPal, on
            PayPal’s own page — nothing about a card is typed here, and this
            site never sees it.
          </p>
          <Button type="button" variant="primary" size="md" onClick={() => setStep("loading")}>
            Continue to PayPal
          </Button>
        </div>
      ) : null}

      {step !== "idle" ? (
        /* The external region: everything inside it is PayPal's, and it says
           so before the brand appears. */
        <section className={styles.embed} aria-label="Payment on PayPal">
          <p className={styles.embedLabel}>External step · PayPal</p>

          {step === "loading" ? (
            <p className={styles.pending} {...politeLive}>
              Loading PayPal’s payment button…
            </p>
          ) : null}

          {step === "failed" ? (
            <p className={styles.failure} {...assertiveLive}>
              PayPal’s payment button could not be loaded here. Use the direct
              link below instead — it is the same payment page.
            </p>
          ) : null}

          {/* Visible from the moment the step is entered, not from `ready`:
              the SDK renders an iframe into this box and needs it laid out,
              and a `display: none` host is how a hosted button comes back
              zero-sized. Empty, it holds the height the button will take.
              Only the failed state removes it, because nothing will arrive. */}
          <div
            ref={containerRef}
            id={CONTAINER_ID}
            className={styles.embedHost}
            hidden={step === "failed"}
          />

          {/* Always present once the step has been entered, not only on
              failure: a hosted button opens a popup, and a blocked popup is
              a failure this page is never told about. */}
          <p className={styles.fallback}>
            If PayPal’s button does not appear or its window is blocked, open{" "}
            <a className={styles.fallbackLink} href={PAYPAL_DIRECT_URL} target="_blank" rel="noreferrer">
              the PayPal payment page
            </a>{" "}
            directly.
          </p>
        </section>
      ) : null}
    </div>
  );
}
