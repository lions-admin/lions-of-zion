"use client";

import { createAuthClient } from "@neondatabase/auth/next";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

const auth = createAuthClient();

/**
 * Session control belongs in the console header, next to the identity it
 * ends. It used to be the last element on the page, below the cost table —
 * reachable only after tabbing through every source row and every editor
 * field.
 */
export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      size="md"
      type="button"
      onClick={async () => {
        await auth.signOut();
        router.replace("/admin/login");
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
