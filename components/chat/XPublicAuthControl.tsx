'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './x-public-auth-control.module.css';

type State =
  | { status: 'checking' }
  | { status: 'anonymous' }
  | { status: 'signed-in'; username: string };

function username(payload: unknown): string | null {
  const value = payload && typeof payload === 'object'
    ? (payload as { profile?: { username?: unknown } }).profile?.username
    : null;
  return typeof value === 'string' && value.trim() ? value.trim().replace(/^@+/, '') : null;
}

/* The official X mark. `aria-hidden` because the link's own text already says
   what this is — announcing it twice is noise to a screen reader. */
function XMark() {
  return (
    <svg
      className={styles.mark}
      viewBox="0 0 1200 1227"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M714.163 519.284 1160.89 0h-105.86L667.137 450.887 357.328 0H0l468.492 681.821L0 1226.37h105.866l409.625-476.152 327.181 476.152H1200L714.137 519.284h.026ZM569.165 687.828l-47.468-67.894L144.011 79.694h162.604l304.797 435.991 47.468 67.894 396.2 566.721H892.476L569.165 687.854v-.026Z"
      />
    </svg>
  );
}

/** This shows public X identity only; public chat remains anonymous by design. */
export function XPublicAuthControl() {
  const router = useRouter();
  const [auth, setAuth] = useState<State>({ status: 'checking' });
  const [signingOut, setSigningOut] = useState(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/public-auth/session', {
        credentials: 'same-origin',
        signal,
      });
      const value = response.ok ? username(await response.json()) : null;
      setAuth(value ? { status: 'signed-in', username: value } : { status: 'anonymous' });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setAuth({ status: 'anonymous' });
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void refresh(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [refresh]);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch('/auth/x/signout', { method: 'POST', credentials: 'same-origin' });
    } finally {
      setAuth({ status: 'anonymous' });
      setSigningOut(false);
      router.refresh();
    }
  };

  if (auth.status === 'checking') return null;
  if (auth.status === 'anonymous') {
    return (
      <a className={styles.loginLink} href="/auth/x">
        <XMark />
        Continue with X
      </a>
    );
  }
  return (
    <div className={styles.account}>
      <XMark />
      <span className={styles.username} title={`@${auth.username}`}>@{auth.username}</span>
      <button type="button" className={styles.signOut} disabled={signingOut} onClick={() => void signOut()}>
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  );
}
