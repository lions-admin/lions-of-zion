"use client";

import { useEffect, useState } from "react";
import { createAuthClient } from "@neondatabase/auth/next";
import { useRouter } from "next/navigation";
import styles from "./admin.module.css";

type Status = {
  status: string;
  environment: string;
  region: string;
  aiBudgetUsd: number;
  integrations: Record<string, boolean>;
};

const auth = createAuthClient();

export function AdminStatus() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/admin/status", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 403 ? "החשבון הזה אינו מורשה." : "לא ניתן לטעון את מצב המערכות.");
        return response.json() as Promise<Status>;
      })
      .then(setStatus)
      .catch((cause: Error) => setError(cause.message));
  }, []);

  if (error) return <p className={styles.error} role="alert">{error}</p>;
  if (!status) return <p className={styles.muted}>טוען מצב…</p>;

  return (
    <>
      <div className={styles.summary}>
        <div><span>סביבה</span><strong>{status.environment}</strong></div>
        <div><span>אזור</span><strong>{status.region}</strong></div>
        <div><span>תקרת AI באפליקציה</span><strong>${status.aiBudgetUsd.toFixed(2)}</strong></div>
      </div>
      <div className={styles.grid}>
        {Object.entries(status.integrations).map(([name, active]) => (
          <article className={styles.service} key={name}>
            <span className={active ? styles.ok : styles.wait}>{active ? "מוכן" : "ממתין"}</span>
            <h2>{name}</h2>
          </article>
        ))}
      </div>
      <button className={styles.secondary} type="button" onClick={async () => { await auth.signOut(); router.replace("/admin/login"); router.refresh(); }}>
        יציאה
      </button>
    </>
  );
}
