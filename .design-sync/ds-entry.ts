/**
 * The Claude Design bundle entry for Lions of Zion.
 *
 * This repository is a Next.js application, not a published component
 * library: there is no `dist/`, no `exports` map, and no library build. So the
 * entry is authored rather than discovered — it names exactly the components
 * that are real, reusable design-system parts AND can run outside a Next
 * server.
 *
 * Deliberately excluded, with reasons (see .design-sync/NOTES.md):
 *   - components/particle-nav/**  — WebGPU/TSL via `three/webgpu`, needs a real
 *     GPU and the baked `public/particles/*.bin` buffers. It cannot render in
 *     a headless preview, and it is a rendering engine rather than a
 *     design-system component.
 *   - ChatParticleCanvas, ParticleChatLauncher — same, transitively.
 *   - ScanBackdrop — an async Server Component that reads the monitoring
 *     corpus off disk with `node:fs`. Nothing in a browser bundle can run it.
 *   - SectionPage, DocPage, SectionBlock, HomeFrontPage — page shells that
 *     hard-depend on ScanBackdrop.
 */

/* The reading-surface component library — the real design system. */
export {
  ClaimRecordPair,
  ContentCard,
  CorrectionHistory,
  FigureRow,
  KnownUnknownPanel,
  PublicationMeta,
  SensitiveContent,
  SourceList,
  Timeline,
  VerificationBadge,
} from '@/components/content';

/* Reading-surface furniture that carries no server dependency. */
export { ReadingProgress } from '@/components/sections/ReadingProgress';
export { SectionToc } from '@/components/sections/SectionToc';
export { AskAboutFileCta } from '@/components/sections/AskAboutFileCta';

/* Participation surfaces. */
export { ReportClaimForm } from '@/components/support/ReportClaimForm';
export { VolunteerInterestForm } from '@/components/support/VolunteerInterestForm';
export { ShareVerifiedButton } from '@/components/support/ShareVerifiedButton';

/* The brief, and its error state. */
export { GeopoliticalBrief } from '@/components/briefs/GeopoliticalBrief';
export { BriefError } from '@/components/briefs/BriefError';

/* Chat. `ChatOpenProvider` is context AskAboutFileCta reads — it ships so the
   provider is available to previews and to designs built with the DS. */
export { AskTheLionChat } from '@/components/chat/AskTheLionChat';
export { ChatOpenProvider } from '@/components/chat/chat-open-context';

/* The root wrapper. See `.design-sync/shims/DesignSurface.tsx` — this system is
   dark-first and its ground lives on `<body>` in the app, which does not exist
   outside it. Every value it sets reads an existing token. */
export { DesignSurface } from '@/.design-sync/shims/DesignSurface';
