import type { HomepageEdition } from '@/server/contracts/homepage';
import { HomeNewsSection } from './HomeNewsSection';
import { HomeNarrativesSection } from './HomeNarrativesSection';
import { HomeArchiveSection } from './HomeArchiveSection';
import { HomeHeroesSection } from './HomeHeroesSection';
import { HomeHistorySection } from './HomeHistorySection';
import { HomeSystemSection } from './HomeSystemSection';
import styles from './homepage-journey.module.css';

const SECTION_NAMES:Record<string,string>={news:'News & Analysis',fakeResistance:'Narratives & fact checks',october7:'October 7',heroes:'Our Heroes',israelsStory:'Israel’s Story'};

export function HomepageJourney({edition}:{edition:HomepageEdition}){
 const standby=edition.standby.map(section=>SECTION_NAMES[section]).filter(Boolean);
 return <div className={styles.journey}>
 <div className={styles.edition}>
  <p>One desk. A wider record.</p>
  <span className={styles.editionMeta}>
   {edition.localPreview?'Local preview · ':''}
   {edition.editionDate?`Edition ${edition.editionDate}`:'Edition unavailable'}
   {edition.state==='previous-edition'?' · Previous edition':''}
  </span>
 </div>
 {/* Standby membership is a rotation through the committed catalogue, not an
     editor's selection for today. Saying which sections it filled is cheaper
     than the alternative, which is a reader taking a rotation for a choice. */}
 {standby.length?<p className={styles.editionNote}>
  Today’s selection for {standby.join(', ')} is drawn from the standing catalogue rather than a published edition.
 </p>:null}
 <HomeNewsSection section={edition.news}/><HomeNarrativesSection section={edition.fakeResistance}/><HomeArchiveSection section={edition.october7}/><HomeHeroesSection section={edition.heroes}/><HomeHistorySection section={edition.israelsStory}/><HomeSystemSection/>
 </div>;
}
