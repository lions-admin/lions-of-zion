"use client";

/**
 * Magic Card's pointer-relative light, adapted to the existing Card surface.
 * Source: https://github.com/magicuidesign/magicui/blob/main/apps/www/registry/magicui/magic-card.tsx
 * No spring, theme provider, motion dependency, or idle animation. The host
 * keeps its server-rendered content and owns every semantic interaction.
 *
 * MIT License — Copyright (c) Magic UI
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { useEffect, useRef } from "react";

export function PointerHighlight() {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const host = marker.current?.parentElement;
    if (!host) return;

    const allowed = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    let frame: number | null = null;
    let clientX = 0;
    let clientY = 0;

    const clear = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      delete host.dataset.pointerHighlight;
      host.style.removeProperty("--pointer-x");
      host.style.removeProperty("--pointer-y");
    };

    const move = (event: PointerEvent) => {
      if (
        !allowed.matches || event.pointerType !== "mouse" ||
        host.matches('[aria-disabled="true"], [aria-busy="true"], :disabled') ||
        host.closest("[data-sensitive]") || host.querySelector("[data-sensitive]")
      ) {
        clear();
        return;
      }
      clientX = event.clientX;
      clientY = event.clientY;
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const bounds = host.getBoundingClientRect();
        // Convert screen coordinates back to the host's local CSS space.
        if (!bounds.width || !bounds.height) return;
        host.style.setProperty("--pointer-x", `${(clientX - bounds.left) * host.offsetWidth / bounds.width}px`);
        host.style.setProperty("--pointer-y", `${(clientY - bounds.top) * host.offsetHeight / bounds.height}px`);
        host.dataset.pointerHighlight = "";
      });
    };

    host.addEventListener("pointermove", move, { passive: true });
    host.addEventListener("pointerleave", clear);
    host.addEventListener("pointercancel", clear);
    host.addEventListener("focusin", clear);
    window.addEventListener("blur", clear);
    window.addEventListener("scroll", clear, { capture: true, passive: true });
    window.addEventListener("resize", clear);
    document.addEventListener("visibilitychange", clear);
    allowed.addEventListener("change", clear);

    return () => {
      clear();
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", clear);
      host.removeEventListener("pointercancel", clear);
      host.removeEventListener("focusin", clear);
      window.removeEventListener("blur", clear);
      window.removeEventListener("scroll", clear, true);
      window.removeEventListener("resize", clear);
      document.removeEventListener("visibilitychange", clear);
      allowed.removeEventListener("change", clear);
    };
  }, []);

  return <span ref={marker} hidden aria-hidden="true" />;
}
