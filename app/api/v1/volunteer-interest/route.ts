import { handler, parseBody } from "@/server/http/handler";
import { created } from "@/server/http/responses";
import { volunteerInterestSchema } from "@/server/contracts/volunteer";
import { bucketFor, VOLUNTEER_SUBMISSION } from "@/server/core/rate-limit";
import { sendWorkspaceEmail } from "@/server/core/email";
import { rateLimit } from "@/server/modules/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (request) => {
  await rateLimit(bucketFor(request, "volunteer"), VOLUNTEER_SUBMISSION);
  const input = await parseBody(request, volunteerInterestSchema);

  await sendWorkspaceEmail({
    to: "volunteers@lionsofzion.io",
    subject: "New volunteer interest — Lions of Zion",
    replyTo: input.email,
    text: [
      `Name: ${input.name || "Not provided"}`,
      `Reply-to: ${input.email}`,
      `Skill areas: ${input.skills.length ? input.skills.join(", ") : "Not provided"}`,
      `Languages: ${input.languages || "Not provided"}`,
      `Availability: ${input.availability || "Not provided"}`,
    ].join("\n"),
  });

  return created({ status: "received" });
});
