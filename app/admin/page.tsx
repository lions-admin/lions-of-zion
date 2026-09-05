import { Suspense } from "react";
import { UnsavedChangesProvider } from "./UnsavedChanges";
import { OperationsConsole } from "./OperationsConsole";
import styles from "./workspace.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "מרכז השליטה" };

export default function AdminPage() {
  return (
    <main className={styles.root} lang="he" dir="rtl" data-reading-scroll>
      <Suspense fallback={<p role="status">טוען את מרכז השליטה…</p>}>
        <UnsavedChangesProvider><OperationsConsole /></UnsavedChangesProvider>
      </Suspense>
    </main>
  );
}
