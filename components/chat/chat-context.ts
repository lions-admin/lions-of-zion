/**
 * Route-aware chat context, derived from the one source of truth for the
 * eight destinations: `defaultNodes`. The launcher label and the chat's
 * starter questions both read from here so a new node picks up both for free.
 */

import { defaultNodes } from '@/components/particle-nav/config';
import type { NavNode } from '@/components/particle-nav/types';

/** Words in node labels that must keep their capitals when spoken mid-sentence. */
const PROPER_WORDS: Record<string, string> = {
  OCTOBER: 'October',
  "ISRAEL'S": "Israel's",
};

/** Openers that already read naturally without a leading article. */
const NO_ARTICLE_STARTS = new Set(['our', 'we', 'this', 'who', 'supporting']);

/**
 * Labels whose word-by-word derivation produces bad English. Everything else
 * is derived, so a new node gets a sensible phrase without touching this file.
 * `geopolitical-brief` keeps the launcher's long-standing "this brief".
 */
const TOPIC_OVERRIDES: Record<string, string> = {
  'geopolitical-brief': 'this brief',
  'support-us': 'supporting us',
  'we-are': 'who we are',
};

const normalizePath = (pathname: string): string =>
  pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

export function nodeForPathname(pathname: string | null): NavNode | null {
  if (!pathname) return null;
  const path = normalizePath(pathname);
  return defaultNodes.find((node) => node.href === path) ?? null;
}

/** "OCTOBER 7" → "October 7", "WAR UPDATE" → "the war update". */
export function topicPhrase(node: NavNode): string {
  const override = TOPIC_OVERRIDES[node.id];
  if (override) return override;
  const phrase = node.label
    .split(/\s+/)
    .map((word) => PROPER_WORDS[word] ?? word.toLowerCase())
    .join(' ');
  const first = phrase.split(' ')[0];
  const startsProper = first !== first.toLowerCase();
  return startsProper || NO_ARTICLE_STARTS.has(first) ? phrase : `the ${phrase}`;
}

/** The launcher's contextual cue. Falls back to the site-wide invitation. */
export function launcherLabel(pathname: string | null): string {
  const node = nodeForPathname(pathname);
  return node ? `Ask about ${topicPhrase(node)}` : 'Ask the Lion';
}

/** Three tappable openers for the chat's empty state. */
export function starterQuestions(pathname: string | null): string[] {
  const node = nodeForPathname(pathname);
  if (!node) {
    return [
      'What claims have been verified recently?',
      'Which sources does the desk rely on?',
      'How does verification work here?',
    ];
  }
  const phrase = topicPhrase(node);
  return [
    `What is verified about ${phrase}?`,
    `Which sources back the newest item on ${phrase}?`,
    'How does verification work here?',
  ];
}
