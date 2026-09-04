"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthRequired, refusedForAuth } from "./auth-required";

/**
 * One console read, with the four states an operator has to be able to tell
 * apart and that used to be folded into two.
 *
 *  - `loading`       nothing has arrived yet. The panel shows its skeleton.
 *  - `ready`         the read succeeded; `value` is the wire shape.
 *  - `auth-required` refused for want of a session (STATE-005). Not a fault;
 *                    the first move is "sign in", never "retry".
 *  - `unavailable`   the route answered 404: this deployment does not serve
 *                    it yet. The console is built against the shared contract
 *                    ahead of every endpoint, so a missing route is an
 *                    ordinary state with its own words, never a crash.
 *  - `failed`        the read failed for any other reason. "Try again" is the
 *                    right first move.
 */
export type ReadState<T> =
  | { kind: "loading" }
  | { kind: "ready"; value: T }
  | { kind: "auth-required" }
  | { kind: "unavailable" }
  | { kind: "failed"; message: string };

export type ConsoleRead<T> = {
  state: ReadState<T>;
  /** The last good value, kept through a background refresh so a panel does
   *  not blank while the operations chat reloads it. */
  value: T | null;
  reload: () => void;
};

/** Every console path is relative to `/api/v1/`. */
export const api = (path: string) => `/api/v1/${path}`;

export class RouteUnavailable extends Error {
  constructor(path: string) {
    super(`${path} is not available in this deployment.`);
    this.name = "RouteUnavailable";
  }
}

/** Reads one route into its wire shape, throwing the typed absences. */
export async function readConsole<T>(path: string): Promise<T> {
  const response = await fetch(api(path), { cache: "no-store" });
  if (refusedForAuth([response])) throw new AuthRequired();
  if (response.status === 404) throw new RouteUnavailable(path);
  if (!response.ok) throw new Error(`Unable to read ${path}.`);
  return (await response.json()) as T;
}

type Options = {
  /** Bumped by the shell when the operations chat reports a state change,
   *  so the active area re-reads without flashing back to its skeleton. */
  signal?: number;
  /** `false` holds the read — a sub-panel not yet opened. */
  enabled?: boolean;
};

export function useConsoleRead<T>(path: string, { signal = 0, enabled = true }: Options = {}): ConsoleRead<T> {
  const [state, setState] = useState<ReadState<T>>({ kind: "loading" });
  const [value, setValue] = useState<T | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    readConsole<T>(path)
      .then((next) => {
        if (!live) return;
        setValue(next);
        setState({ kind: "ready", value: next });
      })
      .catch((cause: unknown) => {
        if (!live) return;
        if (cause instanceof AuthRequired) setState({ kind: "auth-required" });
        else if (cause instanceof RouteUnavailable) setState({ kind: "unavailable" });
        else setState({ kind: "failed", message: cause instanceof Error ? cause.message : `Unable to read ${path}.` });
      });
    return () => {
      live = false;
    };
  }, [path, enabled, signal, tick]);

  const reload = useCallback(() => {
    setState((current) => (current.kind === "ready" ? current : { kind: "loading" }));
    setTick((current) => current + 1);
  }, []);

  return { state, value, reload };
}

/**
 * A mutation against the console. Resolves to the parsed body; throws the
 * same typed absences as a read so a panel's `fail` handler needs one branch.
 */
export async function callConsole<T = unknown>(
  path: string,
  init: { method: "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown; failure?: string },
): Promise<T> {
  const response = await fetch(api(path), {
    method: init.method,
    headers: init.body === undefined ? undefined : { "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (refusedForAuth([response])) throw new AuthRequired();
  if (response.status === 404) throw new RouteUnavailable(path);
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const detail = payload && typeof payload === "object" && "detail" in payload ? String((payload as { detail: unknown }).detail) : null;
    throw new Error(detail || init.failure || `${path} failed.`);
  }
  return payload as T;
}
