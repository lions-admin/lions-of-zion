/**
 * Step 3 (continued) — POST the assembled, locally-validated package to the
 * ingest API and report the result.
 *
 * No retry here by design: the task spec is explicit that a rejected
 * submission should surface verbatim and exit non-zero, not be repaired and
 * resent automatically.
 */

import {
  externalBriefingPublishResultSchema,
  type ExternalBriefingPackage,
} from "@/server/contracts/external-briefing";

const DEFAULT_TARGET_URL = "https://lionsofzion.io";

/** An empty-but-set env var (a workflow passing through an unset repo
 * variable) must fall back to the default exactly like an unset one. */
function targetBaseUrl(): string {
  return process.env.BRIEFING_INGEST_BASE_URL?.trim() || DEFAULT_TARGET_URL;
}

type ProblemBody = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
    errors?: unknown;
  };
};

export async function submitPackage(pkg: ExternalBriefingPackage): Promise<void> {
  const secret = process.env.EXTERNAL_BRIEFING_INGEST_SECRET;
  if (!secret) {
    console.error("EXTERNAL_BRIEFING_INGEST_SECRET is not set. Refusing to submit without the ingest secret.");
    process.exitCode = 1;
    return;
  }

  const url = `${targetBaseUrl()}/api/internal/briefing/external-publish`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-external-briefing-secret": secret,
      },
      body: JSON.stringify(pkg),
    });
  } catch (cause) {
    console.error(`Request to ${url} failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    process.exitCode = 1;
    return;
  }

  const bodyText = await response.text();
  let bodyJson: unknown;
  try {
    bodyJson = bodyText ? JSON.parse(bodyText) : undefined;
  } catch {
    bodyJson = undefined;
  }

  if (response.ok) {
    const parsed = externalBriefingPublishResultSchema.safeParse(bodyJson);
    if (!parsed.success) {
      console.error(
        `Ingest API returned HTTP ${response.status} but the body did not match the expected result contract:`,
      );
      console.error(bodyText);
      for (const issue of parsed.error.issues) {
        console.error(`  ${issue.path.join(".") || "(root)"}: ${issue.message}`);
      }
      process.exitCode = 1;
      return;
    }

    const result = parsed.data;
    console.log(
      `Published: status=${result.status} runId=${result.runId} localDate=${result.localDate} evidenceCreated=${result.evidenceCreated}`,
    );
    console.log(`Brief hub: ${result.briefUrl}`);
    for (const publication of result.publications) {
      console.log(`  [${publication.section}] ${publication.title}`);
      console.log(`    ${publication.url}`);
    }
    return;
  }

  const problem = bodyJson as ProblemBody | undefined;
  console.error(`Ingest API rejected the submission: HTTP ${response.status}`);
  if (problem?.error) {
    console.error(`code=${problem.error.code ?? "unknown"} requestId=${problem.error.requestId ?? "unknown"}`);
    console.error(problem.error.message ?? "(no message)");
    if (problem.error.errors !== undefined) {
      console.error("validation errors:");
      console.error(JSON.stringify(problem.error.errors, null, 2));
    }
  } else {
    console.error(bodyText);
  }
  process.exitCode = 1;
}
