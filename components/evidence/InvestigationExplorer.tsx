'use client';

import { useState } from 'react';
import type { PublicPublicationDetail } from '@/server/contracts/publication';
import { VERIFICATION_STATES } from '@/components/live/publication-labels';
import styles from './investigation-explorer.module.css';

type Stage = { id: string; label: string; title: string; body: string; sources?: PublicPublicationDetail['sources']; items?: string[] };

function uniqueSources(sources: PublicPublicationDetail['sources']) {
  return sources.filter((source, index) => sources.findIndex(candidate => candidate.url === source.url && candidate.title === source.title) === index);
}

/** A readable evidence path for any published investigation. It never draws an
 * inference from a relationship the public projection does not actually carry. */
export function InvestigationExplorer({ record }: { record: PublicPublicationDetail }) {
  const [selected, setSelected] = useState(0);
  const details = record.narrativeWatchDetails;
  const sources = uniqueSources(record.sources);
  const verification = details ? VERIFICATION_STATES[details.verificationState] : null;
  const stages: Stage[] = [
    { id: 'claim', label: 'Claim', title: details ? 'The claim being examined' : 'The reporting question', body: details?.exactClaim ?? record.summary ?? record.title },
    { id: 'origin', label: 'Origin', title: 'Public record cited by this article', body: sources.length ? 'These are the public materials the published record links to. Open them to inspect the original reporting.' : 'No public source link is available in this record.', sources },
    { id: 'spread', label: 'Observed spread', title: 'What the record observes', body: details?.propagators.length ? 'These named propagators are recorded in the article. This does not by itself establish coordination or affiliation.' : 'This record does not name observed propagators.', items: details?.propagators },
    { id: 'evidence', label: 'Evidence', title: 'What the sources support', body: sources.length ? 'The article cites these materials as its public evidence. It does not represent reposting or citation alone as proof of coordination.' : 'No source relationship is published for this record.', sources },
    { id: 'finding', label: 'Finding', title: verification?.label ?? 'Published finding', body: verification?.meaning ?? 'Read the complete article for the published finding and its source context.' },
    { id: 'limits', label: 'Limitations', title: 'What remains unresolved', body: details?.knownUnknowns.length ? 'The record keeps these limits visible rather than converting them into certainty.' : 'No further limitations are recorded in this article.', items: details?.knownUnknowns },
    { id: 'lesson', label: 'Recognition lesson', title: 'How to read a claim responsibly', body: 'Trace a claim to its origin, check whether sources are independent, and distinguish a citation, repost, affiliation and demonstrated coordination.' },
  ];
  const active = stages[selected]!;

  return <section className={styles.explorer} aria-labelledby="evidence-explorer-title">
    <header><p>Follow the evidence</p><h2 id="evidence-explorer-title">From claim to record</h2><span>Each stage is a reading path through this published investigation.</span></header>
    <div className={styles.desktop}>
      <div className={styles.stages} role="tablist" aria-label="Investigation stages">
        {stages.map((stage, index) => <button key={stage.id} role="tab" aria-selected={selected === index} aria-controls={`evidence-panel-${stage.id}`} id={`evidence-tab-${stage.id}`} onClick={() => setSelected(index)}>
          <span>{String(index + 1).padStart(2, '0')}</span>{stage.label}
        </button>)}
      </div>
      <StagePanel stage={active} id={`evidence-panel-${active.id}`} labelledBy={`evidence-tab-${active.id}`} />
    </div>
    <ol className={styles.mobile} aria-label="Evidence journey in reading order">
      {stages.map((stage, index) => <li key={stage.id}><details open={index === 0}><summary><span>{String(index + 1).padStart(2, '0')}</span>{stage.label}</summary><StageContents stage={stage} /></details></li>)}
    </ol>
  </section>;
}

function StagePanel({ stage, id, labelledBy }: { stage: Stage; id: string; labelledBy: string }) {
  return <div className={styles.panel} role="tabpanel" id={id} aria-labelledby={labelledBy}><StageContents stage={stage} /></div>;
}

function StageContents({ stage }: { stage: Stage }) {
  return <><h3>{stage.title}</h3><p>{stage.body}</p>{stage.items?.length ? <ul>{stage.items.map(item => <li key={item}>{item}</li>)}</ul> : null}{stage.sources?.length ? <ol className={styles.sources}>{stage.sources.map((source, index) => <li key={source.url ?? `${source.title}-${index}`}><a href={source.url ?? undefined} target={source.url ? '_blank' : undefined} rel={source.url ? 'noreferrer' : undefined}>{source.title}</a><span>{source.publisher}{source.publishedAt ? ` · ${new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(source.publishedAt))}` : ''}</span></li>)}</ol> : null}</>;
}
