"use client";

import type { ConsoleUsers } from "@/server/contracts/admin-console";
import { EmptyLine, PanelTitle, Pill, ReadGate, formatAgo, formatDate } from "./console-primitives";
import { Stat, StatGrid } from "./_command/StatusCards";
import { useConsoleRead } from "./useConsoleRead";
import cmd from "./command.module.css";
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
                <>
                  <div className={`${styles.tableWrap} ${cmd.desktopOnly}`}>
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

                  <div className={cmd.sourceCards} aria-label="משתמשים ציבוריים רשומים">
                    {value.publicReaders.map((user) => (
                      <article className={cmd.sourceCard} key={user.id} aria-label={user.displayName}>
                        <div className={cmd.sourceCardHead}>
                          <h3 className={cmd.sourceCardName}><bdi>{user.displayName}</bdi></h3>
                          <Pill tone={user.disabledAt ? "warn" : "ok"}>{user.disabledAt ? "מושבת" : "פעיל"}</Pill>
                        </div>
                        <p className={cmd.sourceCardMeta}><bdi>{user.email ?? "ללא דוא״ל"}</bdi></p>
                        <p className={cmd.sourceCardMeta}>נרשם {formatDate(user.createdAt)}</p>
                        {user.disabledAt ? <p className={cmd.sourceCardMeta}>הושבת {formatDate(user.disabledAt)}</p> : null}
                        <p className={cmd.sourceCardId}>מזהה חשבון · <bdi>{user.id}</bdi></p>
                        <p className={cmd.sourceCardId}>מזהה ספק · <bdi>{user.externalId}</bdi></p>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyLine>אין כרגע משתמשים ציבוריים רשומים.</EmptyLine>
              )}
            </div>

            <div className={styles.panel}>
              <PanelTitle note={`${value.staff.length} חשבונות`}>צוות</PanelTitle>
              {value.staff.length ? (
                <>
                  <div className={`${styles.tableWrap} ${cmd.desktopOnly}`}>
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
                            <td>{user.lastActionAt ? formatAgo(user.lastActionAt) : "מעולם לא"}</td>
                            <td>{formatDate(user.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className={cmd.sourceCards} aria-label="חשבונות צוות">
                    {value.staff.map((user) => (
                      <article className={cmd.sourceCard} key={user.id} aria-label={user.displayName}>
                        <div className={cmd.sourceCardHead}>
                          <h3 className={cmd.sourceCardName}><bdi>{user.displayName}</bdi></h3>
                          <Pill tone={user.isAdmin ? "gold" : "neutral"}>{user.isAdmin ? "מנהל" : "צוות"}</Pill>
                        </div>
                        <p className={cmd.sourceCardMeta}><bdi>{user.email ?? "ללא דוא״ל"}</bdi></p>
                        <p className={cmd.sourceCardMeta}>פעולה אחרונה · {user.lastActionAt ? formatAgo(user.lastActionAt) : "מעולם לא"}</p>
                        <p className={cmd.sourceCardMeta}>נוצר {formatDate(user.createdAt)}</p>
                        {user.disabledAt ? <p className={cmd.sourceCardMeta}>הושבת {formatDate(user.disabledAt)}</p> : null}
                        {user.capabilities.length ? (
                          <details>
                            <summary>{user.capabilities.length} הרשאות</summary>
                            <ul className={styles.plainList}>
                              {user.capabilities.map((grant) => (
                                <li key={grant.capability}><bdi>{grant.capability}</bdi></li>
                              ))}
                            </ul>
                          </details>
                        ) : (
                          <p className={cmd.sourceCardMeta}>ללא הרשאות</p>
                        )}
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyLine>אין כרגע חשבונות צוות.</EmptyLine>
              )}
            </div>
          </>
        )}
      </ReadGate>
    </section>
  );
}
