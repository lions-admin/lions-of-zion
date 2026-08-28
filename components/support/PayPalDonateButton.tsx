"use client";

import { useEffect, useRef } from "react";

const PAYPAL_CLIENT_ID =
  "BAAgpvkmgagTCH_kxjOA8JfyQbZBrFmp4cRt3w2d0oqQA0DnMezirBosa311pZQvP24hSYQjqEolAcYF14";
const HOSTED_BUTTON_ID = "PZPE4USUV3W7E";

declare global {
  interface Window {
    paypal?: {
      HostedButtons: (options: { hostedButtonId: string }) => {
        render: (selector: string) => void;
      };
    };
  }
}

export function PayPalDonateButton() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const renderButton = () => {
      if (!cancelled && window.paypal && containerRef.current) {
        window.paypal
          .HostedButtons({ hostedButtonId: HOSTED_BUTTON_ID })
          .render("#paypal-donate-button");
      }
    };

    if (window.paypal) {
      renderButton();
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&components=hosted-buttons&disable-funding=venmo&currency=USD`;
    script.async = true;
    script.addEventListener("load", renderButton);
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      script.removeEventListener("load", renderButton);
    };
  }, []);

  return <div ref={containerRef} id="paypal-donate-button" />;
}
