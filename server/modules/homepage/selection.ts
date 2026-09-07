import { homeSections, homeSelectionSchema, type HomeReference, type HomeSelection, type HomeOverrides } from '@/server/contracts/homepage';

export type DisplayHistory = Record<string, string>;
export type HomepagePublicationPlacement = {
  area: 'news' | 'fakeResistance' | 'people';
  position: 'lead' | 'secondary';
  key: string;
};
/** Membership is frozen by the store. This function never runs during a page GET. */
export function selectHomepage(candidates: HomeReference[], date: string, history: DisplayHistory,
  overrides: HomeOverrides, placements: HomepagePublicationPlacement[] = []): HomeSelection {
  const pins = overrides.pins.filter(p => !p.expires || p.expires >= date).sort((a,b)=>a.order-b.order).map(p=>p.key);
  const breaking = overrides.breakingNews && overrides.breakingNews.expires >= date ? overrides.breakingNews.keys : [];
  const unique = [...new Map(candidates.map(c=>[c.key,c])).values()];
  const selection: HomeSelection = {news:[],fakeResistance:[],october7:[],heroes:[],israelsStory:[],people:[]};
  const cutoff = new Date(`${date}T12:00:00Z`); cutoff.setUTCDate(cutoff.getUTCDate()-7);
  const cutoffDate = cutoff.toISOString().slice(0,10);
  const selected = new Set<string>();
  for (const section of homeSections) {
    const areaPlacements = placements.filter(placement => placement.area === section);
    const sectionPins = [...areaPlacements.sort((a, b) => a.position === b.position ? 0 : a.position === 'lead' ? -1 : 1).map(placement => placement.key),
      ...(section==='news'?breaking:[]),
      ...pins.filter(key=>overrides.pins.some(p=>p.key===key && p.section===section))];
    const rank = (c:HomeReference) => {const i=sectionPins.indexOf(c.key);return i<0?Infinity:i};
    const pool = unique.filter(c=>c.section===section && !selected.has(c.key));
    pool.sort((a,b)=>{
      const pinDiff=rank(a)-rank(b); if(!Number.isNaN(pinDiff) && pinDiff) return pinDiff;
      // Media is a preference for automatic composition, never an eligibility
      // requirement. Explicit placements still win even when they are text-only.
      const mediaDiff=Number(Boolean(b.mediaId))-Number(Boolean(a.mediaId)); if(mediaDiff)return mediaDiff;
      if(section !== 'news' && section !== 'fakeResistance') {
        const recentA=(history[a.key]??'')>cutoffDate, recentB=(history[b.key]??'')>cutoffDate;
        if(recentA!==recentB) return recentA?1:-1;
        const oldest=(history[a.key]??'').localeCompare(history[b.key]??'');if(oldest)return oldest;
      }
      return b.date.localeCompare(a.date)||a.key.localeCompare(b.key);
    });
    // Prefer both semantic kinds, without displacing explicit pins.
    const chosen:HomeReference[]=[];
    if (section==='october7') pool.sort((a,b)=> {
      const diff=rank(a)-rank(b); if(!Number.isNaN(diff)&&diff)return diff;
      return Number(b.kind==='testimony')-Number(a.kind==='testimony');
    });
    /* An explicit lead/secondary placement occupies its exact spot. A missing
       * or stale placement falls through to automatic selection for that one
       * position, and no placement can bleed into another homepage area. */
    for (const position of ['lead', 'secondary'] as const) {
      const placement = areaPlacements.find(value => value.position === position);
      const item = placement ? pool.find(candidate => candidate.key === placement.key) : undefined;
      if (item && !chosen.includes(item)) chosen.push(item);
    }
    for(const item of pool.filter(c=>rank(c)<Infinity && !chosen.includes(c)).slice(0,2-chosen.length)) chosen.push(item);
    if(chosen.length===0 && pool[0]) chosen.push(pool[0]);
    if(chosen.length<2){
      const different=(section==='october7'||section==='fakeResistance')
        ?pool.find(c=>!chosen.includes(c)&&c.kind!==chosen[0]?.kind):undefined;
      const next=different??pool.find(c=>!chosen.includes(c));if(next)chosen.push(next);
    }
    selection[section]=chosen; chosen.forEach(c=>selected.add(c.key));
  }
  return homeSelectionSchema.parse(selection);
}
