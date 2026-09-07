"use client";

import type { ConsoleUsers } from "@/server/contracts/admin-console";
import { EmptyLine, PanelTitle, Pill, ReadGate, formatDate } from "./console-primitives";
import { Stat, StatGrid } from "./_command/StatusCards";
import { useConsoleRead } from "./useConsoleRead";
import styles from "./admin.module.css";

type PublicReader = {
  id: string;
  email: string | null;
  displayName: string;
  externalId: string;
  disabledAt: string | null;
  createdAt: string;
};

type UsersPayload = ConsoleUsers & {
  publicReaders: PublicReader[];
};

export function UsersPanel({ signal }: { signal: number }) {
  const users = useConsoleRead<UsersPayload>("admin/console/users", { signal });

  return (
    <section className={styles.area} id="console-users" aria-labelledby="console-users-heading">
      <h2 id="console-users-heading" className={styles.srOnly}>משתמשים והרשאות</h2>
      <ReadGate state={users.state} what="המשתמשים וההרשאות" reload={users.reload}>
        {(value) => (
          <>
            <StatGrid>
              <Stat label="חשבונות צוות" value={String(value.staff.length)} />
              <Stat label="משתמשים ציבוריים רשומים" value={String(value.publicReaders.length)} />
              <Stat
                label="התחברויות שנחסמו"
                value={value.blockedSignInAttempts === null ? "לא נרשם" : String(value.blockedSignInAttempts)}
                tone={value.blockedSignInAttempts ? "warn" : undefined}
              />
              <Stat label="עודכן" value={formatDate(value.generatedAt)} />
            </StatGrid>

            <div className={styles.panel}>
              <PanelTitle note={`${value.publicReaders.length} רשומים`}>משתמשים ציבוריים רשומים</PanelTitle>
              {value.publicReaders.length ? (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">משתמש</th>
                        <th scope="col">סטטוס</th>
                        <th scope="col">מזהה חשבון</th>
                        <th scope="col">מזהה ספק</th>
                        <th scope="col">נרשם</th>
                      </tr>
                    </thead>
                    <tbody>
                      {value.publicReaders.map((user) => (
                        <tr key={user.id}>
                          <th scope="row">
                            <strong>{user.displayName}</strong>
                            <small className={styles.plainSmall}><bdi>{user.email ?? "ללא דוא״ל"}</bdi></small>
                          </th>
                          <td>
                            <Pill tone={user.disabledAt ? "warn" : "ok"}>{user.disabledAt ? "מושבת" : "פעיל"}</Pill>
                          </td>
                          <td><small className={styles.plainSmall}><bdi title={user.id}>{user.id}</bdi></small></td>
                          <td><small className={styles.plainSmall}><bdi title={user.externalId}>{user.externalId}</bdi></small></td>
                          <td>{formatDate(user.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyLine>אין כרגע משתמשים ציבוריים רשומים.</EmptyLine>
              )}
            </div>

            <div className={styles.panel}>
              <PanelTitle>צוות</PanelTitle>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">חשבון</th>
                      <th scope="col">תפקיד</th>
                      <th scope="col">הרשאות</th>
                      <th scope="col">פעולה אחרונה</th>
                      <th scope="col">נוצר</th>
                    </tr>
                  </thead>
                  <tbody>
                    {value.staff.map((user) => (
                      <tr key={user.id}>
                        <th scope="row">
                          <strong>{user.displayName}</strong>
                          <small className={styles.plainSmall}><bdi>{user.email ?? "ללא דוא״ל"}</bdi></small>
                        </th>
                        <td>{user.isAdmin ? <Pill tone="gold">מנהל</Pill> : <Pill tone="neutral">צוות</Pill>}</td>
                        <td>{user.capabilities.map((grant) => grant.capability).join(", ") || "—"}</td>
                        <td>{user.lastActionAt ? formatDate(user.lastActionAt) : "מעולם לא"}</td>
                        <td>{formatDate(user.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </ReadGate>
    </section>
  );
}
