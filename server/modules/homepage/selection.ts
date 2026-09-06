import { homeSections, homeSelectionSchema, type HomeReference, type HomeSelection, type HomeOverrides } from '@/server/contracts/homepage';

export type DisplayHistory = Record<string, string>;
/** Membership is frozen by the store. This function never runs during a page GET. */
export function selectHomepage(candidates: HomeReference[], date: string, history: DisplayHistory,
  overrides: HomeOverrides, publicationPins: string[] = []): HomeSelection {
  const pins = overrides.pins.filter(p => !p.expires || p.expires >= date).sort((a,b)=>a.order-b.order).map(p=>p.key);
  const breaking = overrides.breakingNews && overrides.breakingNews.expires >= date ? overrides.breakingNews.keys : [];
  const unique = [...new Map(candidates.map(c=>[c.key,c])).values()];
  const selection: HomeSelection = {news:[],fakeResistance:[],october7:[],heroes:[],israelsStory:[],people:[]};
  const cutoff = new Date(`${date}T12:00:00Z`); cutoff.setUTCDate(cutoff.getUTCDate()-7);
  const cutoffDate = cutoff.toISOString().slice(0,10);
  const selected = new Set<string>();
  for (const section of homeSections) {
    const sectionPins = [...(section==='news'?breaking:[]), ...publicationPins,
      ...pins.filter(key=>overrides.pins.some(p=>p.key===key && p.section===section))];
    const rank = (c:HomeReference) => {const i=sectionPins.indexOf(c.key);return i<0?Infinity:i};
    const pool = unique.filter(c=>c.section===section && !selected.has(c.key));
    pool.sort((a,b)=>{
      const pinDiff=rank(a)-rank(b); if(!Number.isNaN(pinDiff) && pinDiff) return pinDiff;
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
    for(const item of pool.filter(c=>rank(c)<Infinity).slice(0,2)) chosen.push(item);
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
