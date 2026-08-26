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
    return <a className={styles.loginLink} href="/auth/x">המשך עם X</a>;
  }
  return (
    <div className={styles.account} dir="rtl">
      <span className={styles.username} dir="ltr" title={`@${auth.username}`}>@{auth.username}</span>
      <button type="button" className={styles.signOut} disabled={signingOut} onClick={() => void signOut()}>
        {signingOut ? 'מתנתק…' : 'התנתק'}
      </button>
    </div>
  );
}
