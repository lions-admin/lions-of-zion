import {describe,it,expect,vi,beforeEach} from 'vitest';
import {homeSections} from '@/server/contracts/homepage';
import {isHomepageSafeMedia} from '@/server/contracts/editorial-media';

/* No persisted edition and no reachable database: the state Production was
   actually in. `vercel.json` schedules no homepage cron, so `homepage_edition`
   was never written and every section rendered the same apology with no
   picture on the page. */
const readHomepageSnapshot=vi.fn();
const listBriefingPublications=vi.fn();
const getPublicPublication=vi.fn();
vi.mock('@/lib/publications',()=>({
  readHomepageSnapshot:()=>readHomepageSnapshot(),
  isLocalHomepagePreview:vi.fn(async()=>false),
  listBriefingPublications:(q:string)=>listBriefingPublications(q),
  getPublicPublication:(id:string)=>getPublicPublication(id),
}));
const {getHomepageEdition}=await import('@/lib/homepage');

describe('homepage standby membership',()=>{
  beforeEach(()=>{
    readHomepageSnapshot.mockReset().mockRejectedValue(new Error('database unavailable'));
    listBriefingPublications.mockReset().mockRejectedValue(new Error('database unavailable'));
    getPublicPublication.mockReset().mockRejectedValue(new Error('database unavailable'));
  });

  it('still publishes every committed section, each with a safe image',async()=>{
    const edition=await getHomepageEdition();
    for(const section of ['fakeResistance','october7','heroes','israelsStory'] as const){
      expect(edition[section].items.length,`${section} has records`).toBeGreaterThan(0);
      for(const item of edition[section].items){
        expect(isHomepageSafeMedia(item.media),`${section} image is cleared and safe`).toBe(true);
        expect(item.media.src).toMatch(/^\/images\//);
        expect(item.media.alt.length).toBeGreaterThan(0);
      }
    }
    expect(edition.standby).toEqual(homeSections.filter(s=>s!=='news'));
  });

  it('leaves news empty rather than inventing one, and says so',async()=>{
    const edition=await getHomepageEdition();
    expect(edition.news.items).toHaveLength(0);
    expect(edition.standby).not.toContain('news');
  });

  it('carries a published briefing into news with the drawn cover when no photograph is mapped',async()=>{
    listBriefingPublications.mockImplementation(async(query:string)=>
      query.includes('daily_brief')
        ? [{publicId:'brief-1',updatedAt:'2026-09-06T04:00:00Z',publishedAt:'2026-09-06T04:00:00Z'}] : []);
    getPublicPublication.mockResolvedValue({publicId:'brief-1',section:'daily_brief',
      title:'A published daily brief',summary:'What the record supports today.',
      publishedAt:'2026-09-06T04:00:00Z',updatedAt:'2026-09-06T04:00:00Z',sources:[]});
    const edition=await getHomepageEdition();
    expect(edition.standby).toContain('news');
    expect(edition.news.items).toHaveLength(1);
    expect(edition.news.items[0]?.media.src).toBe('/images/homepage/covers/news.svg');
  });
});
