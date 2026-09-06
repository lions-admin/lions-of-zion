import type { HomepageEdition } from '@/server/contracts/homepage';
import { HomeNewsSection } from './HomeNewsSection';
import { HomeNarrativesSection } from './HomeNarrativesSection';
import { HomeArchiveSection } from './HomeArchiveSection';
import { HomeHeroesSection } from './HomeHeroesSection';
import { HomeHistorySection } from './HomeHistorySection';
import { HomeSystemSection } from './HomeSystemSection';
import styles from './homepage-journey.module.css';
export function HomepageJourney({edition}:{edition:HomepageEdition}){
 return <div className={styles.journey}>
 <div className={styles.edition}><p>One desk. A wider record.</p><span>{edition.localPreview?'Local preview · ':''}{edition.editionDate?`Edition ${edition.editionDate}`:'Edition unavailable'}{edition.state==='previous-edition'?' · Previous edition':''}</span></div>
 <HomeNewsSection section={edition.news}/><HomeNarrativesSection section={edition.fakeResistance}/><HomeArchiveSection section={edition.october7}/><HomeHeroesSection section={edition.heroes}/><HomeHistorySection section={edition.israelsStory}/><HomeSystemSection/>
 </div>;
}
