'use client';

import { useEffect, useRef, useState } from 'react';
import lionReference from '@/assets/reference/crowned-lion-particle-reference.png';
import { ChatParticleCanvas } from './ChatParticleCanvas';
import { AskTheLionChat } from './AskTheLionChat';
import styles from './particle-chat-launcher.module.css';

export function ParticleChatLauncher() {
  const activeRef = useRef(false);
  const activationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activated, setActivated] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const active = hovered || focused || activated;

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => () => {
    if (activationTimerRef.current) clearTimeout(activationTimerRef.current);
  }, []);

  useEffect(() => {
    const openChat = () => setChatOpen(true);
    window.addEventListener('lions:open-ai-chat', openChat);
    return () => window.removeEventListener('lions:open-ai-chat', openChat);
  }, []);

  useEffect(() => {
    if (!chatOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setChatOpen(false);
        launcherRef.current?.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [chatOpen]);

  const activate = () => {
    setActivated(true);
    if (chatOpen) {
      setChatOpen(false);
    } else {
      window.dispatchEvent(new CustomEvent('lions:open-ai-chat'));
    }
    if (activationTimerRef.current) clearTimeout(activationTimerRef.current);
    activationTimerRef.current = setTimeout(() => setActivated(false), 1100);
  };

  const closeChat = () => {
    setChatOpen(false);
    requestAnimationFrame(() => launcherRef.current?.focus());
  };

  return (
    <aside
      className={styles.root}
      data-active={active ? '' : undefined}
      data-open={chatOpen ? '' : undefined}
    >
      {chatOpen ? <AskTheLionChat onClose={closeChat} /> : null}
      <div className={styles.launcherRow}>
        <span className={styles.label} aria-hidden="true">
          <span>Ask the Lion</span>
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
              data-hidden={canvasReady ? '' : undefined}
            />
          </span>
          <ChatParticleCanvas activeRef={activeRef} onReady={() => setCanvasReady(true)} />
        </button>
      </div>
    </aside>
  );
}
