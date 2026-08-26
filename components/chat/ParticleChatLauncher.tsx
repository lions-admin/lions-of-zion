'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import lionReference from '@/assets/reference/crowned-lion-particle-reference.png';
import { ChatParticleCanvas } from './ChatParticleCanvas';
import { AskTheLionChat } from './AskTheLionChat';
import { launcherLabel } from './chat-context';
import { useChatOpen } from './chat-open-context';
import {
  INTRO_SIGNAL_ATTRIBUTES,
  INTRO_SIGNAL_SELECTOR,
  introRouteDefault,
} from '@/components/particle-nav/introSignal';
import styles from './particle-chat-launcher.module.css';

const MOBILE_CHAT_QUERY = '(max-width: 719px)';

function subscribeToMobileChat(callback: () => void) {
  const query = window.matchMedia(MOBILE_CHAT_QUERY);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

function getMobileChatSnapshot() {
  return window.matchMedia(MOBILE_CHAT_QUERY).matches;
}

function useMobileChatSculpture() {
  // The server renders the resilient image fallback. Desktop progressively
  // upgrades it after hydration; mobile never pays for a second GPU renderer.
  return useSyncExternalStore(subscribeToMobileChat, getMobileChatSnapshot, () => true);
}

/* The intro owns the screen while it plays, and this launcher is mounted in the
   root layout — a sibling of the page, with no provider between them. The nav
   already publishes its state as DOM attributes (`CanvasMount`), which the
   stylesheet below reads through `body:has(…)`, so the signal is read the same
   way here rather than by introducing the repo's first context.

   Reading it in JavaScript as well as in CSS is what stops the second WebGPU
   renderer inside `ChatParticleCanvas` from running behind a hidden element for
   the whole intro, and what lets the attention cue start its animation at the
   beginning rather than mid-cycle. */
function subscribeToIntro(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.body, {
    subtree: true,
    // The nav mounts after hydration, so the attribute usually arrives on a new
    // node rather than as a change to an existing one.
    childList: true,
    attributes: true,
    attributeFilter: [...INTRO_SIGNAL_ATTRIBUTES],
  });
  return () => observer.disconnect();
}

function getIntroSnapshot() {
  return document.querySelector(INTRO_SIGNAL_SELECTOR) !== null;
}

function useIntroSuppressed(assumeIntro: boolean) {
  /* The server cannot know whether the intro will run — that needs a GPU probe
     and a media query. It does know which route asks for one, and the same
     route emits `data-intro-pending` in its first HTML, so the two agree at
     hydration and the launcher never flashes in before being hidden. */
  const getServerSnapshot = useCallback(() => assumeIntro, [assumeIntro]);
  return useSyncExternalStore(subscribeToIntro, getIntroSnapshot, getServerSnapshot);
}

export function ParticleChatLauncher() {
  const pathname = usePathname();
  const introSuppressed = useIntroSuppressed(introRouteDefault(pathname));
  const mobileChatSculpture = useMobileChatSculpture();
  const activeRef = useRef(false);
  const activationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTimerRef = useRef<number | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activated, setActivated] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const { state: chatState, openChat, closeChat: closeChatContext } = useChatOpen();
  const chatOpen = chatState.open;
  const active = hovered || focused || activated;
  const contextualLabel = launcherLabel(pathname);
  const restoreLauncherFocus = useCallback(() => {
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = window.setTimeout(() => launcherRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => () => {
    if (activationTimerRef.current) clearTimeout(activationTimerRef.current);
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
  }, []);

  useEffect(() => {
    if (!chatOpen) return;
    const main = document.querySelector<HTMLElement>('main');
    const wasInert = main?.inert ?? false;
    if (main) main.inert = true;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeChatContext();
        restoreLauncherFocus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      if (main) main.inert = wasInert;
    };
  }, [chatOpen, restoreLauncherFocus, closeChatContext]);

  /* Not hidden — absent. A hidden launcher keeps its particle canvas rendering
     behind the intro's own 45k–180k renderer, keeps a button in the tab order
     the intro has no answer for, and lets the attention cue's 7.2s loop run out
     of phase so it can reappear mid-pulse. Unmounting settles all three, and
     the CSS rule stays as the paint-time belt for the handoff window. */
  if (introSuppressed && !chatOpen) return null;

  const activate = () => {
    setActivated(true);
    openChat();
    if (activationTimerRef.current) clearTimeout(activationTimerRef.current);
    activationTimerRef.current = setTimeout(() => setActivated(false), 1100);
  };

  const closeChat = () => {
    closeChatContext();
    restoreLauncherFocus();
  };

  return (
    <aside
      className={styles.root}
      data-active={active ? '' : undefined}
      data-open={chatOpen ? '' : undefined}
    >
      {chatOpen ? (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Close Ask the Lion chat"
          tabIndex={-1}
          onClick={closeChat}
        />
      ) : null}
      {chatOpen ? <AskTheLionChat onClose={closeChat} /> : null}
      <div className={styles.launcherRow}>
        <span className={styles.label} aria-hidden="true">
          <span>{contextualLabel}</span>
          <span className={styles.labelArrow} />
        </span>
        <button
          ref={launcherRef}
          type="button"
          className={styles.launcher}
          aria-label={chatOpen ? 'Close Ask the Lion AI chat' : 'Open Ask the Lion AI chat'}
          aria-controls="ask-the-lion-chat"
          aria-expanded={chatOpen}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onClick={activate}
        >
          <span className={styles.fallbackClip} aria-hidden="true">
            {/* The fallback is the same particle sculpture used to bake the
                site's WebGPU lion, cropped below the crown. It disappears as
                soon as the live particle renderer produces its first frame. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lionReference.src}
              alt=""
              className={styles.fallbackLion}
              data-hidden={!mobileChatSculpture && canvasReady ? '' : undefined}
            />
          </span>
          {!mobileChatSculpture ? (
            <ChatParticleCanvas activeRef={activeRef} onReady={() => setCanvasReady(true)} />
          ) : null}
        </button>
      </div>
    </aside>
  );
}
