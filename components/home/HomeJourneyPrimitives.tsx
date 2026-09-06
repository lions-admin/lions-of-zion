import Image from 'next/image';
import Link from 'next/link';
import type { EditorialMedia } from '@/server/contracts/editorial-media';
import type { HomeSource, HomepageSection, HomePreview } from '@/server/contracts/homepage';
import styles from './homepage-journey.module.css';
export function JourneyLink({href,children}:{href:string;children:React.ReactNode}){
 return <Link className={styles.link} href={href}><span>{children}</span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M4 12h15M13 5l7 7-7 7"/></svg></Link>;
}
export function SectionHeading({id,kicker,title,href,action}:{id:string;kicker:string;title:string;href:string;action:string}){
 return <header className={styles.sectionHead}><div><p className={styles.kicker}>{kicker}</p><h2 id={id}>{title}</h2></div><JourneyLink href={href}>{action}</JourneyLink></header>;
}
export function HomeMedia({media,portrait=false}:{media:EditorialMedia;portrait?:boolean}){
 return <figure className={`${styles.figure} ${portrait?styles.portrait:''}`}>
 <Image src={media.src} alt={media.alt} width={media.width} height={media.height} loading="lazy"
 sizes={portrait?'(max-width:767px) 100vw, 45vw':'(max-width:767px) 100vw, (max-width:1100px) 60vw, 55vw'}
 style={{objectPosition:`${media.focalPoint.x}% ${media.focalPoint.y}%`}}/>
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
export function SectionState({section}:{section:HomepageSection<HomePreview>}){
 if(section.items.length)return section.state==='partial'?<p className={styles.availability}>One selected record is available in this edition.</p>:null;
 return <p className={styles.availability}>{section.state==='unavailable'?'This selection is temporarily unavailable. You can still explore the full section.':'No records are selected for this edition. Explore the full section above.'}</p>;
}
