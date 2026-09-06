import Image from 'next/image';
import Link from 'next/link';
import type { EditorialMedia } from '@/server/contracts/editorial-media';
import type { HomeSource, HomepageSection, HomePreview } from '@/server/contracts/homepage';
import styles from './homepage-journey.module.css';

export function JourneyLink({href,children}:{href:string;children:React.ReactNode}){
 return <Link className={styles.link} href={href}>{children}<span aria-hidden="true">↗︎</span></Link>;
}

/** `intro` is rendered inside the header so a phone reads kicker, title,
 *  what the section is, and only then the way in. Stacked outside it, the
 *  action arrived before the sentence explaining what it led to. */
export function SectionHeading({id,kicker,title,href,action,intro}:{id:string;kicker:string;title:string;href:string;action:string;intro?:string}){
 return <header className={styles.sectionHead}>
  <div className={styles.sectionHeadTitle}><p className={styles.kicker}>{kicker}</p><h2 id={id}>{title}</h2></div>
  {intro?<p className={styles.sectionIntro}>{intro}</p>:null}
  <JourneyLink href={href}>{action}</JourneyLink>
 </header>;
}

export function HomeMedia({media,portrait=false}:{media:EditorialMedia;portrait?:boolean}){
 /* Drawn covers are SVG and the image optimizer answers 400 for SVG without
    `dangerouslyAllowSVG`. Serving our own vector files straight from
    `public/` keeps them sharp at every density and turns that flag on for
    nobody. */
 const vector=media.src.endsWith('.svg');
 return <figure className={`${styles.figure} ${portrait?styles.portrait:''}`}>
 <span className={styles.figureFrame}>
 <Image src={media.src} alt={media.alt} width={media.width} height={media.height} loading="lazy" unoptimized={vector}
 sizes={portrait?'(max-width:767px) 42vw, 22vw':'(max-width:767px) 100vw, (max-width:1100px) 50vw, 60vw'}
 style={{objectPosition:`${media.focalPoint.x}% ${media.focalPoint.y}%`}}/>
 </span>
 <figcaption>{media.caption&&<span>{media.caption} </span>}<span>{media.credit}</span>{media.sourceUrl&&<> · <a href={media.sourceUrl}>Image source</a></>}
 {media.rights.reference.startsWith('https://creativecommons.org')&&<> · <a href={media.rights.reference}>{media.rights.basis}</a></>}
 </figcaption></figure>;
}

export function HomeSources({sources}:{sources:HomeSource[]}){
 if(!sources.length)return null;
 return <p className={styles.sources}>Source: <a href={sources[0].url}>{sources[0].label}</a>{sources.length>1?' · Further sources in the full record':''}</p>;
}

export function HomeTime({date,includeTime=false}:{date:string;includeTime?:boolean}){
 const parsed=new Date(date);if(Number.isNaN(parsed.getTime()))return <span className={styles.meta}>{date}</span>;
 return <time className={styles.meta} dateTime={parsed.toISOString()}>{new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',day:'numeric',month:'short',year:'numeric',...(includeTime?{hour:'2-digit',minute:'2-digit'} as const:{})}).format(parsed)}{includeTime?' · Israel time':''}</time>;
}

/**
 * What a section says when it has nothing, or only half of what it wanted.
 *
 * It used to be one grey sentence on an otherwise empty band, and for a long
 * time it was the whole homepage: with no persisted edition every section
 * rendered it, so the page was five apologies and no pictures. It is a
 * composed stand-in now — the section's own drawn cover, the sentence, and
 * the way into the full section — but it still says plainly that nothing was
 * selected. A stand-in may not look like a record.
 */
export function SectionState({section,cover,href,action}:{section:HomepageSection<HomePreview>;cover:string;href:string;action:string}){
 if(section.items.length)return section.state==='partial'
  ?<p className={styles.availability}>One selected record is available in this edition.</p>:null;
 return <div className={styles.standin}>
  <span className={styles.standinArt} style={{backgroundImage:`url(${cover})`}} aria-hidden="true"/>
  <div className={styles.standinBody}>
   <p className={styles.standinLead}>{section.state==='unavailable'
    ?'No record could be loaded for this edition.'
    :'No record is selected for this edition.'}</p>
   <p className={styles.availability}>The section itself is complete and open to read.</p>
   <JourneyLink href={href}>{action}</JourneyLink>
  </div>
 </div>;
}
