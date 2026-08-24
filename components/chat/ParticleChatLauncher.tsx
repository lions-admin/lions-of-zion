'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import lionReference from '@/assets/reference/crowned-lion-particle-reference.png';
import { ChatParticleCanvas } from './ChatParticleCanvas';
import { AskTheLionChat } from './AskTheLionChat';
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

export function ParticleChatLauncher() {
  const pathname = usePathname();
  const mobileChatSculpture = useMobileChatSculpture();
  const activeRef = useRef(false);
  const activationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTimerRef = useRef<number | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activated, setActivated] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const active = hovered || focused || activated;
  const contextualLabel = pathname === '/geopolitical-brief' ? 'Ask about this brief' : 'Ask the Lion';
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
        setChatOpen(false);
        restoreLauncherFocus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      if (main) main.inert = wasInert;
    };
  }, [chatOpen, restoreLauncherFocus]);

  const activate = () => {
    setActivated(true);
    setChatOpen(true);
    if (activationTimerRef.current) clearTimeout(activationTimerRef.current);
    activationTimerRef.current = setTimeout(() => setActivated(false), 1100);
  };

  const closeChat = () => {
    setChatOpen(false);
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
