# The Lions of Zion ChatGPT app

Two paths reach this system from ChatGPT, and they do different jobs. Confusing
them is the mistake this document exists to prevent.

```
                         ChatGPT
                            │
             ┌──────────────┴──────────────┐
             │                             │
        Conversation                  Apps SDK UI  (phase 2)
             │                             │
             └──────────────┬──────────────┘
                            │
                         Remote MCP
                            │
                   ChatGPT Automation
                            │
          ┌─────────────────┼────────────────┐
          │                 │                │
     Publications       Homepage           Ops
          │                 │                │
          └─────────────────┼────────────────┘
                            │
                     Production DB
```

**MCP is for looking and for exceptional repair.** Live context before a
decision, checking whether a developing story already exists, inspecting a run,
diagnosing an incident, and reversible operational control when something needs
fixing between editions.

**Publishing an edition is not done here.** That remains:

```
ChatGPT
→ whole-site-update-v2 package
→ chatgpt-editorial-updates branch
→ GitHub Action
→ POST /api/internal/editorial-updates/ingest
→ durable editorial run
→ Production
```

The two complement each other because they answer different questions. The
package path is atomic, idempotent, replayable and reviewable as a single
artefact — the right shape for a whole edition. MCP is conversational and
immediate — the right shape for "what is on the homepage right now" and for
"archive that duplicate". Turning MCP into a second composer would give up
every property the package path was built for.

## The endpoint

| | |
| --- | --- |
| **Production** | `https://lionsofzion.io/api/internal/chatgpt/mcp` |
| **Preview** | `https://<deployment>.vercel.app/api/internal/chatgpt/mcp` |
| Transport | Streamable HTTP (POST only; `GET`/`DELETE` answer `405`) |
| Auth | OAuth 2.1 with PKCE |
| Identity | `service:chatgpt-editorial` |

### Why not `/api/mcp`

`accessFor()` in `server/http/handler.ts` grants a database role by path
prefix, and grants **nothing** to a path that is neither `/api/v1/` nor a named
service prefix. A route at `/api/mcp` would therefore run on the ambient owner
pool: outside RLS, with no `app.identity`. That is precisely the bug the
handler's own comment records for `/api/internal/briefing/` before 2026-09-05.

Under `/api/internal/chatgpt/` the endpoint inherits `app_service` /
`service:chatgpt-editorial`, and `server/modules/chatgpt-mcp/server.ts`
additionally establishes the role itself so the transport stays inside RLS even
if the route wrapper changes.

### Preview and Production are separate

Tokens are signed with `CHATGPT_AUTOMATION_SECRET`, which differs per
environment, so a Preview token cannot address Production. Each deployment also
advertises its own origin in the discovery documents (`getPublicOrigin` reads
the forwarded headers, not `request.url`), so a Preview connection cannot be
pointed at Production by accident.

## Authentication

ChatGPT supports **OAuth, No Authentication, or a mix** for a custom MCP
connector. There is no static-header option — the header the HTTP automation
API uses cannot authenticate a conversation — and an unauthenticated endpoint
that can archive a published article is not something to put on the public
internet. Hence OAuth.

```
ChatGPT → POST /api/internal/chatgpt/mcp        (no token)
        ← 401 + WWW-Authenticate: resource_metadata=…
        → GET /.well-known/oauth-protected-resource
        → GET /.well-known/oauth-authorization-server
        → GET  /api/internal/chatgpt/oauth/authorize   (owner signs in)
        ← 302 with ?code=…
        → POST /api/internal/chatgpt/oauth/token       (PKCE verifier)
        ← access_token (1h) + refresh_token (30d)
```

Four properties carry the security:

- **The consent step is `authenticateAdmin()`** — the same check the admin
  console uses. Only the owner's session can complete the flow.
- **The redirect target is an allowlist**, checked on the parsed origin rather
  than a prefix, so `https://chatgpt.com.evil.test` does not match.
- **PKCE with S256 is required**, not optional. OAuth 2.1 drops `plain`, and
  offering a method that proves nothing is worse than offering none.
- **The identity is not in the token.** It decodes to an id and an expiry;
  the actor label is a module constant. A client that could name its own actor
  could file its actions under someone else.

Tokens are HMAC-signed rather than stored, following the reasoning already
recorded for ops confirmations. The cost is that a single token cannot be
revoked: **rotating `CHATGPT_AUTOMATION_SECRET` invalidates all of them**, and
that is the revocation path.

## The tools

34 tools: the 28 operational tools adapted from `OPS_TOOL_DEFINITIONS`, plus
six the ops registry has no equivalent for.

| Tool | For |
| --- | --- |
| `get_editorial_context` | The whole picture in one bounded call. Start here. |
| `find_publication` | Resolve by `publicId` or `canonicalStoryId` — the duplicate check |
| `get_homepage` | The current edition and its six placements |
| `get_editorial_runs` / `get_editorial_run` | Recent runs; one run with its research, vetoes and failures kept apart |
| `get_ops_view` | One read-only console view from a fixed allowlist |

Nothing is restated: every operational tool's name, description, zod input and
behaviour come from the existing registry, and every call goes through
`chatgptAutomationService.invoke`, which owns the capability policy, the
`delete → archive` substitution and the `chatgpt.tool.*` audit row.

**Annotations are load-bearing.** A tool without `readOnlyHint` is treated by
ChatGPT as a write and asks the user to approve every call; 22 reads carry it
and 12 writes do not. `delete_publication` is annotated `destructiveHint:
false` and its description says plainly that it archives — claiming a
destructiveness it does not have would train the operator to dismiss the
warnings that are real.

**Every tool works with no UI.** Each returns `structuredContent` the model can
reason over plus a text summary, so a plain MCP client is fully served.

## The interactive views

Five MCP Apps templates, registered as resources and bound to a tool through
`_meta.ui.resourceUri` (with `openai/outputTemplate` as the compatibility
alias).

| Template | Drawn from | Shows |
| --- | --- | --- |
| `editorial-overview` | `get_editorial_context` | Edition, homepage revision, counts, warnings, records grouped by hub, recent runs |
| `publication` | `find_publication` | Identity, status, cited sources, media state, update log, reversible actions |
| `homepage` | `get_homepage` | All six slots, including the empty ones on automatic selection |
| `editorial-run` | `get_editorial_run` | Published, researched, **vetoed**, and separately **failed** |
| `ops-dashboard` | `get_ops_view` | Counts first, then the rows that need a person |

Five rather than the eight surfaces named in the brief, because several are
views of one record: a publication's sources, its evidence and its media all
arrive in one projection, so splitting them would mean three round trips to
draw one card. The research ledger and the vetoes belong to the run that
produced them, which is the whole reason those fields exist on a v2 report.

### What the templates are, technically

**Everything is inlined** — markup, CSS and script travel in the resource body.
Nothing is fetched from `lionsofzion.io`, which is what makes this work: the
site sends `frame-ancestors 'none'` and `X-Frame-Options: DENY` on every path,
so a template that loaded anything from this origin would be blocked. There is
no bundler and no build step.

**No framework.** A React runtime inlined five times would be most of the
payload, to render a list and a card.

**The host's theme comes first.** Colours read `var(--openai-color-*, <lions
fallback>)`, so the widget takes ChatGPT's own palette where it exists and
falls back to the site's. The type roles are the site's own: a display serif
for headlines, a sans for text, a mono for data, body never below 16px and
metadata never below 13px — the same floors `UX-CONTRACT.md` sets for a phone.

### Three things the markup is careful about

**A veto is not an error.** `Vetoed — editorial decisions, not faults` sits
above `Failed — technical faults`, and a veto never takes the alert tone.
Colour alone is never the signal: every status pill carries a word. For a
`whole-site-update-v1` run both sections say the contract could not represent
them, rather than showing an empty list that would read as "the editor refused
nothing".

**A generated image is never documentation.** The media block leads with the
role and the rights state; an editorial illustration says
*"not evidence"* before anything else about it.

**There is no delete button.** Through this connector the tool archives, so the
actions are Archive, Take off the site and Publish — each stating its
consequence before it runs — and the panel says plainly that deletion is not
offered. After any action the widget re-reads the server rather than repainting
what it assumed happened.

### Fallback

The UI is an enhancement. Every tool returns `structuredContent` and a text
summary, so a client with no template support — or a template that fails to
render — still gets a usable answer. That is tested, not assumed.

## Observability

An MCP call writes two records. The audit row (`chatgpt.tool.<name>`, actor
`service:chatgpt-editorial`) says *who and what*; the log line
(`mcp.tool.done` / `mcp.tool.failed` with `transport: "mcp"`, the tool, the
duration and the outcome) says *how it arrived*. Together they distinguish an
MCP call from an HTTP automation call from a human at the console from the
package pipeline.

## Connecting it in ChatGPT

A workspace admin must first enable developer mode:
**Workspace Settings → Permissions & Roles → Connected Data**.

Then, per user:

1. **Settings → Security and login → Developer mode**, on.
2. **ChatGPT Plugins → +**.
3. Name it *Lions of Zion — Editorial & Operations*.
4. URL: `https://lionsofzion.io/api/internal/chatgpt/mcp` — **including the
   path**.
5. Authentication: OAuth. Sign in as the owner when prompted.
6. Create the connection, then confirm the tools appear.

Verify with a conversation: *"Show me the current Lions of Zion editorial
state"*, then the homepage, then a known publication.

## Testing it directly

```bash
npx @modelcontextprotocol/inspector@latest
# Transport: Streamable HTTP.  URL: <endpoint>.  Auth: OAuth.
```

Never paste a token into a committed file or a shared log.

## Known limits

- **Scheduled Tasks are unverified.** The current documentation says scheduled
  tasks on the web can use plugins, but does not say whether an *unpublished
  developer-mode* plugin counts, and says nothing about OAuth refresh in an
  unattended run. Until that is tested, the daily edition keeps going through
  the package pipeline, which does not depend on any of this.
- **A single token cannot be revoked** — see above.
- **The Apps SDK UI is phase 2.** The tools are designed to be useful without
  it, and will stay that way.
