"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import styles from "./narrative-simulation.module.css";

const stages = [
  { name: "Detect the spread", title: "Two groups. One circulating claim.",
    detail: "Separate influencer groups repeat the same allegation. Shared wording is a lead to investigate—not proof of coordination." },
  { name: "Isolate the claim", title: "Turn the narrative into a testable question.",
    detail: "“Nothing got through” is an absolute claim. We need the location, the date and the full period—not just a moment at a closed gate." },
  { name: "Search both sides", title: "Look for evidence that could change the answer.",
    detail: "Search for the original material, the full timeline and separate records. Keep evidence that supports the claim alongside evidence that challenges it." },
  { name: "Examine the framing", title: "Is the material false—or the framing misleading?",
    detail: "In this example, the closed-gate footage is genuine. The manipulation is presenting one morning moment as evidence of an entire day." },
  { name: "Publish the finding", title: "Show the conclusion. Keep the limits visible.",
    detail: "A useful finding explains what happened, what the evidence supports and what remains unknown. It does not turn suspicion into certainty." },
];
const people = [
  [46, 52], [132, 35], [210, 70], [70, 137], [172, 151], [245, 127],
  [414, 55], [500, 32], [572, 74], [390, 143], [473, 149], [570, 146],
];
const connections = [[0,1],[0,3],[1,2],[1,4],[2,5],[3,4],[4,5],[6,7],[6,9],[7,8],[7,10],[8,11],[9,10],[10,11]];
const evidence = [
  { id: "clip", type: "Original video", time: "Morning", side: "supports",
    text: "The gate is closed.", context: "Supports a temporary closure at the moment filmed. It cannot establish what happened throughout the day." },
  { id: "sequence", type: "Full video sequence", time: "Later that day", side: "challenges",
    text: "The gate reopens.", context: "The wider sequence includes trucks passing through. That contradicts the claim that nothing entered all day." },
  { id: "record", type: "Separate delivery record", time: "Same day", side: "challenges",
    text: "Deliveries are recorded.", context: "A separate record supports the later passage of deliveries. It does not establish whether the district received enough aid." },
] as const;

function SpreadMap() {
  return (
    <div className={styles.spreadMap}>
      <div className={styles.groupLabels}><span>Influencer group 1</span><span>Influencer group 2</span></div>
      <svg viewBox="0 0 620 265" role="img" aria-label="Two fictional groups of influencers share posts that converge on the same claim. Lines represent sharing in this example, not proven coordination.">
        <g className={styles.networkLinks}>
          {connections.map(([a, b]) => <path key={a + "-" + b} d={`M${people[a][0]} ${people[a][1]}L${people[b][0]} ${people[b][1]}`} />)}
        </g>
        <g className={styles.networkFeeds}>
          <path d="M172 168V194Q172 214 195 214H286Q310 214 310 240V264" />
          <path d="M473 166V194Q473 214 450 214H334Q310 214 310 240" />
        </g>
        <g className={styles.networkSignals} aria-hidden="true">
          <path pathLength="100" d="M172 168V194Q172 214 195 214H286Q310 214 310 240V264" />
          <path pathLength="100" d="M473 166V194Q473 214 450 214H334Q310 214 310 240" />
        </g>
        {people.map(([x, y], index) => <g key={index} transform={`translate(${x} ${y})`} className={styles.creator} data-group={index < 6 ? "first" : "second"}>
          <circle r={index === 4 || index === 10 ? 21 : 16} />
          <circle cy="-4" r="4" className={styles.creatorGlyph} />
          <path d="M-7 8C-7 0 7 0 7 8" className={styles.creatorGlyph} />
        </g>)}
      </svg>
    </div>
  );
}

export function HomeEvidencePipeline() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [activeEvidence, setActiveEvidence] = useState<string | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const running = playing && visible && !reduced && step < stages.length - 1;
  const stage = stages[step];

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(preference.matches);
    sync();
    preference.addEventListener("change", sync);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.2 });
    if (host.current) observer.observe(host.current);
    return () => { observer.disconnect(); preference.removeEventListener("change", sync); };
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setStep((current) => Math.min(current + 1, stages.length - 1));
    }, 8500);
    return () => window.clearInterval(timer);
  }, [running, step]);

  function selectStep(index: number) {
    setStep(index);
    setPlaying(false);
    setActiveEvidence(null);
  }

  function togglePlayback() {
    if (step === stages.length - 1) {
      setStep(0);
      setActiveEvidence(null);
      setPlaying(true);
    } else setPlaying((current) => !current);
  }

  return (
    <div ref={host} className={styles.simulation} data-running={running} data-step={step}>
      <div className={styles.toolbar}>
        <span>Fictional walkthrough <span className={styles.disclosure}>· No real accounts or live searches</span></span>
        <button type="button" onClick={togglePlayback} disabled={reduced}
          aria-label={reduced ? "Autoplay disabled for reduced motion; select a stage below" : step === stages.length - 1 ? "Replay the investigation" : playing ? "Pause the investigation" : "Play the investigation"}>
          <Icon name={step === stages.length - 1 ? "correction" : "film"} size={17} />
          {reduced ? "Manual mode" : step === stages.length - 1 ? "Replay" : playing ? "Pause" : "Play"}
        </button>
      </div>
      <ol className={styles.stages} aria-label="Investigation stages">
        {stages.map((item, index) => <li key={item.name} data-active={step === index} data-reached={step >= index}>
          <button type="button" onClick={() => selectStep(index)} aria-current={step === index ? "step" : undefined} aria-controls={panelId}>
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span className={styles.stageLabel}>{item.name}</span>
          </button>
        </li>)}
      </ol>
      <p className={styles.stageName}>{stage.name}</p>
      <div className={styles.scene} id={panelId} aria-live={running ? "off" : "polite"} onFocusCapture={() => setPlaying(false)}>
        <div className={styles.case}>
          <span className={styles.eyebrow}>The claim being tested</span>
          <blockquote>“No aid entered the district <mark>all day.</mark>”</blockquote>
          <span className={styles.caseStatus}><span aria-hidden="true" />{step === 4 ? "Finding: misleading in this example" : "Unverified · investigation in progress"}</span>
        </div>
        <div className={styles.visual} key={step}>
          {step === 0 && <div className={styles.spread}>
            <SpreadMap />
            <div className={styles.sharedPost}><Icon name="share" size={20} /><p>Different accounts.<br /><strong>The same closed-gate clip.</strong></p></div>
          </div>}
          {step === 1 && <div className={styles.claimFocus}>
            <span className={styles.eyebrow}>What would have to be true?</span>
            <p className={styles.absolute}>All day<span>≠</span>One moment</p>
            <dl><div><dt>Place</dt><dd>The district’s crossing</dd></div><div><dt>Period</dt><dd>The full day in question</dd></div><div><dt>Test</dt><dd>Did any delivery enter?</dd></div></dl>
            <p className={styles.note}>A closed gate in one clip cannot answer an all-day claim.</p>
          </div>}
          {step === 2 && <div className={styles.evidenceSearch}>
            <div className={styles.searchLine}><Icon name="search" size={18} /><span>Original upload · full sequence · delivery records</span><span className={styles.scan} aria-hidden="true" /></div>
            <div className={styles.evidenceColumns}>
              {["supports", "challenges"].map((side) => <div key={side}>
                <h4>{side === "supports" ? "Supports part of the claim" : "Challenges the all-day claim"}</h4>
                {evidence.filter((item) => item.side === side).map((item) => <article key={item.id} className={styles.evidenceItem}>
                  <span>{item.time} · {item.type}</span>
                  <button type="button" aria-expanded={activeEvidence === item.id} aria-controls={panelId + item.id}
                    onClick={() => { setPlaying(false); setActiveEvidence(activeEvidence === item.id ? null : item.id); }}>
                    {item.text}<Icon name="chevron-down" size={17} />
                  </button>
                  <p id={panelId + item.id} hidden={activeEvidence !== item.id}>{item.context}</p>
                </article>)}
              </div>)}
            </div>
            <p className={styles.note}>Illustrative evidence. Select a record to inspect what it does—and does not—establish.</p>
          </div>}
          {step === 3 && <div className={styles.framing}>
            <div className={styles.timeline}>
              <div><span>Shown in the posts</span><strong>Morning closure</strong><p>Gate closed</p></div>
              <div><span>Left out of the narrative</span><strong>Later reopening</strong><p>Deliveries enter</p></div>
            </div>
            <ul className={styles.reviewList}>
              <li><Icon name="warning" size={19} /><span><strong>Selective timing</strong>A moment is presented as a whole day.</span></li>
              <li><Icon name="share" size={19} /><span><strong>Repetition, not corroboration</strong>Both groups circulate the same clip.</span></li>
              <li><Icon name="search" size={19} /><span><strong>Intent and coordination remain unknown</strong>Shared material alone does not establish either.</span></li>
            </ul>
          </div>}
          {step === 4 && <article className={styles.finding}>
            <div className={styles.findingTop}><Icon name="assessment" size={24} /><span>Example published finding</span></div>
            <h4>A real closure.<br />A misleading all-day claim.</h4>
            <p>The clip shows a closed gate in the morning. The full sequence and a separate delivery record show later entry. The absolute claim is contradicted by the example’s evidence.</p>
            <dl><div><dt>Evidence trail</dt><dd>Original clip · full sequence · delivery record</dd></div><div><dt>Not established</dt><dd>Aid sufficiency, intent or coordinated activity.</dd></div></dl>
            <button type="button" onClick={() => selectStep(2)}>Revisit the evidence<Icon name="arrow-right" size={18} /></button>
          </article>}
        </div>
        <div className={styles.explanation}>
          <h3>{stage.title}</h3><p>{stage.detail}</p>
        </div>
      </div>
      <div className={styles.navigation}>
        <button type="button" onClick={() => selectStep(Math.max(step - 1, 0))} disabled={step === 0}>Previous</button>
        <span>{step + 1} / {stages.length}</span>
        <button type="button" onClick={() => selectStep(step === stages.length - 1 ? 0 : step + 1)}>{step === stages.length - 1 ? "Start again" : "Next stage"}<Icon name="arrow-right" size={17} /></button>
      </div>
    </div>
  );
}
