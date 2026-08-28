import "server-only";

import nodemailer from "nodemailer";
import {
  googleWorkspaceSmtpAppPassword,
  googleWorkspaceSmtpUser,
  mayActOnTheWorld,
} from "@/server/core/config";
import { ApiError } from "@/server/http/responses";

export type WorkspaceEmail = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
};

/** Sends only from production, using a Google app password kept in Vercel. */
export async function sendWorkspaceEmail(input: WorkspaceEmail): Promise<void> {
  if (!mayActOnTheWorld()) {
    throw new ApiError("PRECONDITION_FAILED", "Email delivery is enabled only in production.");
  }

  const user = googleWorkspaceSmtpUser();
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass: googleWorkspaceSmtpAppPassword() },
  });

  await transporter.sendMail({
    from: user,
    to: input.to,
    subject: input.subject,
    text: input.text,
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
  });
}
