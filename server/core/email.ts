import "server-only";

import nodemailer from "nodemailer";
import {
  googleWorkspaceSmtpAppPassword,
  googleWorkspaceSmtpUser,
  mayActOnTheWorld,
} from "@/server/core/config";
import { db } from "@/server/db/client";
import { briefingLog } from "@/server/core/log";
import { setIdentity } from "@/server/core/versioning";
import { writeAudit } from "@/server/core/audit";
import { ApiError } from "@/server/http/responses";

export type WorkspaceEmail = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
};

/** The provider seam. Defaults to the Google Workspace SMTP transport;
 *  tests inject a runner so telemetry is observable without SMTP access. */
export type EmailSender = (mail: Record<string, unknown>) => Promise<unknown>;

/** Deep-health's error-class discipline: provider text can echo the request
 *  back; the class cannot. */
const errorClass = (cause: unknown): string =>
  cause instanceof ApiError ? cause.code : cause instanceof Error ? cause.name : "UnknownError";

const TELEMETRY_ACTOR = { label: "system:email", userId: null } as const;

/**
 * Writes one email telemetry row in its own transaction — the callers here
 * are post-commit already (a consumer delivering an alert or a notification),
 * so the record of the delivery attempt is its own transaction, the way
 * `recordVersion`'s post-commit audit separates its write.
 */
async function recordEmailTelemetry(action: "email.sent" | "email.failed", after: Record<string, unknown>): Promise<void> {
  await db().transaction(async (tx) => {
    await setIdentity(tx as never, TELEMETRY_ACTOR.label);
    await writeAudit(tx as never, {
      actor: TELEMETRY_ACTOR,
      action,
      entityType: "system",
      entityId: null,
      after,
    });
  });
}

/** Sends only from production, using a Google app password kept in Vercel.
 *
 * The gate itself is never audited: a local or preview deployment throwing
 * "email is production-only" is not a delivery event. Where the send does run
 * in production, its outcome is on the record — `email.sent` with the subject
 * length and recipient (never the body, which the callers fill with report
 * and alert text), or `email.failed` with the error class only. The failure
 * is rethrown so the post-commit consumer sees the delivery failed. */
export async function sendWorkspaceEmail(
  input: WorkspaceEmail,
  send?: EmailSender,
): Promise<void> {
  if (!mayActOnTheWorld()) {
    throw new ApiError("PRECONDITION_FAILED", "Email delivery is enabled only in production.");
  }

  const mail = {
    to: input.to,
    subject: input.subject,
    text: input.text,
  };
  try {
    if (send) {
      await send(mail);
    } else {
      const user = googleWorkspaceSmtpUser();
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user, pass: googleWorkspaceSmtpAppPassword() },
      });

      await transporter.sendMail({
        from: user,
        ...mail,
        ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      });
    }
  } catch (cause) {
    /* The record of a failed delivery is written best-effort: rethrowing the
       delivery failure matters more than its audit row. */
    try {
      await recordEmailTelemetry("email.failed", {
        to: input.to,
        errorClass: errorClass(cause),
      });
    } catch {
      /* logged below */
    }
    briefingLog("error", "email.deliver.failed", {}, {
      to: input.to,
      errorClass: errorClass(cause),
    });
    throw cause;
  }
  /* A delivered email is on the record too — but a telemetry failure here
     must not turn a delivered email into a redelivery (the callers mark
     their ledger only after this returns). */
  try {
    await recordEmailTelemetry("email.sent", {
      to: input.to,
      subjectLength: input.subject.length,
    });
  } catch (cause) {
    briefingLog("warn", "email.sent.audit_failed", {}, {
      to: input.to,
      errorClass: errorClass(cause),
    });
  }
}
