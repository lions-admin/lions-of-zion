# Wide news and narrative entrances — implementation review

## Delivered

- Both entrances use up to 1600px with 40px desktop/20px mobile gutters.
- Narrative entrance no longer uses the document/contents-rail template.
  The latest available investigation sits beside three compact monitoring
  records. Three additional investigations and two depth entrances follow.
- Background essays were moved intact from the hub to the network page.
  The methods already have their dedicated playbook; no essay text was deleted.
- News presents one chronological story beside up to four updates. With only
  one story, the briefing occupies the sidebar and is not repeated below.
  With no news stories, an available briefing is still displayed.
- Archive filtering remains URL-based and does not replace current news.
- Compact monitoring preserves status-before-claim, status meaning and date.
  The claim headline is the link; full records retain context and an action
  that distinguishes analysis without cited sources.
- Homepage video, backend publication rules, authorization and external APIs
  were not changed. Nothing was committed or deployed.

## Verification

- Chromium: both routes at 390, 768, 1024, 1440 and 1920px; HTTP 200 and
  no horizontal overflow. Full-page and first-screen captures inspected.
- Keyboard disclosure, archive GET filtering and clear: passed.
- 200% CSS zoom at 768px: no horizontal overflow. This is not a claim of
  native Safari zoom or a real iPhone test.
- 44 targeted tests passed: section separation, sidebar/briefing behavior,
  empty and failed reads, status/analysis treatment, no-JS shell invariants.
- Typecheck passed; focused lint passed. Production build completed with the
  local monitoring-read configuration warning noted below.
- Premium static scan still flags 10 existing admin-specific form/textarea
  issues outside this task; this is not a clean whole-repository certification.

## Evidence (local temporary artifacts)

- Before desktop news: /tmp/loz-wide-review/before-news.png
- Before mobile narratives: /tmp/loz-wide-review/before-narratives-mobile.png
- Earlier desktop narratives: /tmp/loz-news-review/1440-narratives.png
- Earlier mobile news: /tmp/loz-news-review/390-news.png
- After: /tmp/loz-wide-review/chromium-{width}-{news|narratives}.png
- First screens: same paths with -top.png before the extension.
- Tests, build, typecheck, browser matrix and static audit logs are beside them.

## Limits and content gaps

The local feed currently supplies one individual news story; no additional
stories or imagery were invented. Research questions remain their authored
length. There is no verified reusable evidence image in this implementation,
so the leading investigation is typographic rather than illustrated.
Playwright WebKit is not installed; Safari and real-device testing remain open.
The local production build logs an invalid/redacted DATABASE_URL for the watch
read and renders its designed unavailable fallback; the dev-server browser
checks had publication data. Correct production configuration was not changed
or verified. Build success does not establish live-data availability.
