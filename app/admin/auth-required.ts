/**
 * STATE-005 — the console's fifth absence.
 *
 * Every route under `/api/v1/admin` goes through `authenticateAdmin()` and
 * fails closed, so a signed-out or expired session answers 401/403 to every
 * read the console makes. Reported as a generic failure, that tells an
 * operator the console is broken when the console is working exactly as
 * designed and they are simply not signed in — two different problems whose
 * first moves are "retry" and "sign in", and only one of them helps.
 *
 * Thrown at the point the status is read, so both console panels can tell the
 * two apart without each re-deriving it from a response object they no longer
 * hold.
 */
export class AuthRequired extends Error {
  constructor() {
    super("הכניסה פגה או שהחשבון אינו מחובר. יש להתחבר מחדש.");
    this.name = "AuthRequired";
  }
}

export class PermissionDenied extends Error {
  constructor() {
    super("אין לחשבון הזה הרשאה לפעולה המבוקשת. יש לפנות לבעל המערכת.");
    this.name = "PermissionDenied";
  }
}

/** True when a batch of console reads was refused for want of a session. */
export function refusedForAuth(responses: Array<{ status: number }>): boolean {
  return responses.some((response) => response.status === 401);
}
