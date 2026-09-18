export type CorpusGroup =
  | "identity"
  | "process"
  | "verification"
  | "factcheck"
  | "investigation"
  | "intelligence"
  | "information"
  | "disinformation"
  | "evidence"
  | "israel"
  | "signal"
  | "system"
  | "mission";

export const SIGNAL_CORPUS: Record<CorpusGroup, readonly string[]> = {
  identity: [
    "TRUTH", "SIGNAL", "EVIDENCE", "INTELLIGENCE", "FACTS", "CONTEXT", "CLARITY",
    "CONFIDENCE", "KNOWLEDGE", "REALITY", "PROOF", "SOURCE", "SOURCES",
  ],
  process: [
    "DETECT", "INVESTIGATE", "VERIFY", "EXPLAIN", "PROVE", "SHARE", "ANALYZE",
    "IDENTIFY", "TRACE", "CONNECT", "DOCUMENT", "ARCHIVE", "COMPARE", "REVIEW",
    "CONFIRM", "PUBLISH", "MONITOR",
  ],
  verification: [
    "VERIFIED", "UNVERIFIED", "CONFIRMED", "DISPUTED", "MISLEADING", "FALSE",
    "OUT OF CONTEXT", "INCONCLUSIVE", "PARTIALLY TRUE", "EVIDENCE FOUND",
    "SOURCE VERIFIED", "CLAIM CHECKED",
  ],
  factcheck: [
    "FACT CHECK", "CLAIM", "VERDICT", "PRIMARY SOURCE", "SECONDARY SOURCE",
    "ORIGINAL SOURCE", "SOURCE CHAIN", "CORROBORATION", "CONTRADICTION",
    "CONTEXT CHECK", "IMAGE CHECK", "VIDEO CHECK",
  ],
  investigation: [
    "INVESTIGATION", "RESEARCH", "FINDINGS", "DISCOVERY", "CONNECTION", "NETWORK",
    "TIMELINE", "ENTITY", "ACTOR", "ACCOUNT", "ORGANIZATION", "EVENT", "LOCATION",
    "RECORD",
  ],
  intelligence: [
    "PUBLIC INTELLIGENCE", "OPEN SOURCE", "OSINT", "SIGNAL DETECTION", "PATTERN",
    "INDICATOR", "ACTIVITY", "BEHAVIOR", "NETWORK ANALYSIS", "RELATIONSHIP",
    "MONITORING",
  ],
  information: [
    "INFORMATION", "INFORMATION WARFARE", "INFLUENCE", "INFLUENCE NETWORK",
    "NARRATIVE", "MEDIA", "MESSAGE", "AMPLIFICATION", "DISTRIBUTION", "VIRALITY",
    "REACH",
  ],
  disinformation: [
    "DISINFORMATION", "MISINFORMATION", "PROPAGANDA", "MANIPULATION", "DECEPTION",
    "FABRICATION", "DISTORTION", "FALSE CLAIM", "FALSE NARRATIVE",
    "COORDINATED ACTIVITY", "INAUTHENTIC BEHAVIOR", "IMPERSONATION", "BOT", "TROLL",
  ],
  evidence: [
    "RECEIPTS", "DOCUMENTATION", "SCREENSHOT", "DATA", "METADATA", "LINK",
    "CITATION", "TIMESTAMP", "ORIGIN", "HASH", "CAPTURE", "PROVENANCE",
  ],
  israel: [
    "ISRAEL", "ZION", "JERUSALEM", "JEWISH HISTORY", "JEWISH PEOPLE",
    "ISRAELI SOCIETY", "HISTORY", "IDENTITY", "SOVEREIGNTY", "COURAGE", "SERVICE",
    "INNOVATION", "SCIENCE", "MEDICINE",
  ],
  signal: [
    "NOISE", "SIGNAL OVER NOISE", "PULSE", "STREAM", "FEED", "INPUT", "OUTPUT",
    "MATCH", "ALERT", "WATCH",
  ],
  system: [
    "SYSTEM", "ENGINE", "PIPELINE", "WORKFLOW", "AGENT", "TASK", "QUEUE", "STATUS",
    "RUN", "LOG", "SCAN", "QUERY", "RESULT",
  ],
  mission: [
    "DEFEND THE TRUTH", "FOLLOW THE EVIDENCE", "FIND THE SIGNAL",
    "VERIFY BEFORE AMPLIFYING", "SHOW THE SOURCE", "PROVE THE CLAIM",
    "UNDERSTAND THE NETWORK", "TRUTH HAS A SIGNAL", "TRUTH OVER NOISE",
    "EVIDENCE OVER EMOTION", "FACTS OVER NARRATIVES",
  ],
};

export const VERIFIED_PULSES: readonly string[] = [
  "SOURCE VERIFIED", "EVIDENCE FOUND", "CLAIM CHECKED", "CONFIRMED", "TRACE",
  "PROOF", "FOLLOW THE EVIDENCE", "TRUTH HAS A SIGNAL", "SHOW THE SOURCE",
  "ORIGINAL SOURCE",
];

export function corpusWords(groups?: CorpusGroup[]): string[] {
  const keys = groups ?? (Object.keys(SIGNAL_CORPUS) as CorpusGroup[]);
  return [...new Set(keys.flatMap((key) => SIGNAL_CORPUS[key]))];
}
