/**
 * Prints the before/after comparison tables for the mobile refinement report
 * from the two `results.json` files `verify-mobile.mjs` writes. Markdown to
 * stdout; paste into REPORT.md.
 *
 *   node scripts/homepage/mobile-report.mjs
 */
import { readFile } from 'node:fs/promises';

const root = 'docs/reviews/homepage-mobile-refinement';
const before = JSON.parse(await readFile(`${root}/before/results.json`, 'utf8'));
const after = JSON.parse(await readFile(`${root}/after/results.json`, 'utf8'));
const byName = (report) => Object.fromEntries(report.runs.map((r) => [r.name, r]));
const b = byName(before), a = byName(after);
const names = after.runs.map((r) => r.name);
const px = (n) => (n == null ? '—' : `${Math.round(n)}px`);
const pct = (x, y) => (x && y ? ` (${Math.round(((y - x) / x) * 100)}%)` : '');

console.log('### Distance from the end of the cover to the first story\n');
console.log('| Viewport | To the first image, before → after | To the first headline, before → after | Page height, before → after |');
console.log('| --- | --- | --- | --- |');
for (const n of names) {
  const x = b[n]?.arrival, y = a[n]?.arrival;
  if (!x || !y) continue;
  console.log(`| ${n} | ${px(x.firstImageTop - x.heroBottom)} → ${px(y.firstImageTop - y.heroBottom)}${pct(x.firstImageTop - x.heroBottom, y.firstImageTop - y.heroBottom)} | ${px(x.firstHeadlineTop - x.heroBottom)} → ${px(y.firstHeadlineTop - y.heroBottom)}${pct(x.firstHeadlineTop - x.heroBottom, y.firstHeadlineTop - y.heroBottom)} | ${px(x.documentHeight)} → ${px(y.documentHeight)}${pct(x.documentHeight, y.documentHeight)} |`);
}

console.log('\n### Lead headlines: lines × size\n');
console.log('| Viewport | News lead | Fake Resistance lead | October 7 lead | Our Heroes lead | Israel’s Story lead |');
console.log('| --- | --- | --- | --- | --- | --- |');
const head = (run, section) => { const h = run?.sections?.[section]?.headlines?.[0]; return h ? `${h.lines}L @ ${Math.round(parseFloat(h.fontSize))}px` : '—'; };
for (const n of names) {
  const cells = ['news', 'fakeResistance', 'october7', 'heroes', 'israelsStory'].map((s) => `${head(b[n], s)} → ${head(a[n], s)}`);
  console.log(`| ${n} | ${cells.join(' | ')} |`);
}

console.log('\n### Section heights on the page, before → after\n');
console.log('| Viewport | News | Fake Resistance | October 7 | Our Heroes | Israel’s Story | System |');
console.log('| --- | --- | --- | --- | --- | --- | --- |');
for (const n of names) {
  const cells = ['news', 'fakeResistance', 'october7', 'heroes', 'israelsStory', 'system'].map((s) => `${px(b[n]?.sections?.[s]?.height)} → ${px(a[n]?.sections?.[s]?.height)}`);
  console.log(`| ${n} | ${cells.join(' | ')} |`);
}

console.log('\n### The Ask launcher at seven reading positions (12%–97% of the page)\n');
console.log('Each cell: shown and covering text, an image or a control (**over**), shown with nothing meaningful beneath it (clear), or retracted (—). The first position is reached by an upward jump from the previous section walk, so it also shows the scroll-up reveal.\n');
console.log('| Viewport | Before | After |');
console.log('| --- | --- | --- |');
const cell = (l) => (!l.visible ? '—' : (l.covers ?? (l.under && (l.under.text + l.under.image + l.under.control) > 0)) ? '**over**' : 'clear');
for (const n of names) {
  const cells = (run) => run ? run.launcher.map((l) => `${Math.round(l.fraction * 100)}% ${cell(l)}`).join(', ') : '—';
  console.log(`| ${n} | ${cells(b[n])} | ${cells(a[n])} |`);
}

console.log('\n### Checks that must hold at every width\n');
console.log('| Viewport | Horizontal overflow | Page errors | Launcher reachable by keyboard and visible when focused |');
console.log('| --- | --- | --- | --- |');
for (const n of names) {
  const r = a[n];
  console.log(`| ${n} | ${r.layout.documentWidth > r.layout.viewport ? 'yes' : 'none'} | ${r.errors.length} | ${r.keyboard.launcherFocused ? `yes (${r.keyboard.tabs} tabs)` : 'NO'} |`);
}
console.log(`\nNo JavaScript at 390×844: ${after.noJS.records} records, ${after.noJS.main} main landmark, ${after.noJS.noscriptLinks} fallback navigation links. Reduced motion at 390×844: video ${after.reducedMotion?.videoVisible ? 'visible' : 'not shown'}, poster only.`);
