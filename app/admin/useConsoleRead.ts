"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthRequired, PermissionDenied } from "./auth-required";

export const CONSOLE_CHANGED = "loz:console-changed";
export const CONSOLE_READ = "loz:console-read";
export const api = (path: string) => `/api/v1/${path}`;

export type ReadState<T> =
  | { kind: "loading" }
  | { kind: "ready"; value: T }
  | { kind: "auth-required" }
  | { kind: "forbidden" }
  | { kind: "unavailable" }
  | { kind: "failed"; message: string; staleAt?: string };

export type ConsoleRead<T> = {
  state: ReadState<T>;
  value: T | null;
  updatedAt: string | null;
  refreshing: boolean;
  reload: () => void;
};

export class RouteUnavailable extends Error {
  constructor(path: string) {
    super(`המידע או הפעולה אינם זמינים. פרטים: ${path}`);
    this.name = "RouteUnavailable";
  }
}

async function responseBody<T>(response: Response, path: string, failure: string): Promise<T> {
  if (response.status === 401) throw new AuthRequired();
  if (response.status === 403) throw new PermissionDenied();
  if (response.status === 404) throw new RouteUnavailable(path);
  const text = await response.text();
  let payload: unknown = null;
  try { payload = text ? JSON.parse(text) : null; } catch {
    if (response.ok) throw new Error("השרת החזיר תשובה לא תקינה. יש לנסות שוב.");
  }
  if (!response.ok) {
    const detail = payload && typeof payload === "object" && "detail" in payload ? String(payload.detail) : null;
    throw new Error(detail || `${failure} (${response.status})`);
  }
  return payload as T;
}

export async function readConsole<T>(path: string, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(20_000);
  try {
    const response = await fetch(api(path), { cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
    return await responseBody<T>(response, path, "קריאת הנתונים נכשלה");
  } catch (cause) {
    if (timeout.aborted && !signal?.aborted) throw new Error("השרת לא השיב בזמן. ניתן לנסות שוב.");
    throw cause;
  }
}

type Options = { signal?: number; enabled?: boolean; pollInterval?: number };

type Snapshot<T> = {
  path: string;
  state: ReadState<T>;
  value: T | null;
  updatedAt: string | null;
};

export function useConsoleRead<T>(path: string, { signal = 0, enabled = true, pollInterval }: Options = {}): ConsoleRead<T> {
  const [snapshot, setSnapshot] = useState<Snapshot<T>>({ path, state: { kind: "loading" }, value: null, updatedAt: null });
  const [tick, setTick] = useState(0);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let live = true;
    // Defer only the pending marker; the fetch starts immediately.
    const pending = window.setTimeout(() => { if (live) setPendingPath(path); }, 0);
    readConsole<T>(path, controller.signal).then((value) => {
      if (!live) return;
      const at = new Date().toISOString();
      setSnapshot({ path, state: { kind: "ready", value }, value, updatedAt: at });
      window.dispatchEvent(new CustomEvent(CONSOLE_READ, { detail: { path, at } }));
    }).catch((cause: unknown) => {
      if (!live) return;
      setSnapshot((previous) => {
        const same = previous.path === path;
        const state: ReadState<T> = cause instanceof AuthRequired ? { kind: "auth-required" }
          : cause instanceof PermissionDenied ? { kind: "forbidden" }
            : cause instanceof RouteUnavailable ? { kind: "unavailable" }
              : { kind: "failed", message: cause instanceof Error ? cause.message : "קריאת הנתונים נכשלה.", staleAt: same ? previous.updatedAt ?? undefined : undefined };
        const retain = same && state.kind === "failed";
        return { path, state, value: retain ? previous.value : null, updatedAt: retain ? previous.updatedAt : null };
      });
    }).finally(() => {
      window.clearTimeout(pending);
      if (live) setPendingPath(null);
    });
    return () => { live = false; window.clearTimeout(pending); controller.abort(); };
  }, [path, enabled, signal, tick]);

  useEffect(() => {
    if (!enabled || !pollInterval || pollInterval <= 0) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setTick((current) => current + 1);
    }, pollInterval);
    return () => window.clearInterval(timer);
  }, [enabled, pollInterval, path]);

  const reload = useCallback(() => setTick((current) => current + 1), []);
  const current = enabled && snapshot.path === path;
  return {
    state: current ? snapshot.state : { kind: "loading" },
    value: current ? snapshot.value : null,
    updatedAt: current ? snapshot.updatedAt : null,
    refreshing: pendingPath === path,
    reload,
  };
}

export async function callConsole<T = unknown>(path: string, init: { method: "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown; failure?: string }): Promise<T> {
  const response = await fetch(api(path), {
    method: init.method,
    headers: init.body === undefined ? undefined : { "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const payload = await responseBody<T>(response, path, init.failure ?? "הפעולה נכשלה");
  window.dispatchEvent(new Event(CONSOLE_CHANGED));
  return payload;
}
