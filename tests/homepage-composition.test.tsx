import {describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import type {HomePreview,HomeReference,HomepageEdition} from '@/server/contracts/homepage';
import media from '@/content-packages/homepage/media.json';
import {editorialMediaSchema} from '@/server/contracts/editorial-media';
vi.mock('@/lib/publications',()=>({readHomepageSnapshot:vi.fn(),getPublicPublication:vi.fn()}));
vi.mock('@/lib/content/homepage-adapters',()=>({resolveHomepageReference:vi.fn()}));
import {resolveHomepageSection} from '@/lib/homepage';
import {HOMEPAGE_BANDS} from '@/lib/homepage-bands';
import {HomepageJourney} from '@/components/home/HomepageJourney';
const asset=editorialMediaSchema.parse(media.assets[0]);
const base={key:'a',title:'A full headline',href:'/articles/a',date:'2026-09-05T09:00:00Z',summary:'Published summary.',media:asset,sources:[]};
const empty={state:'empty' as const,items:[],gaps:[]};
function edition():HomepageEdition{return {editionDate:'2026-09-05',revision:1,generatedAt:'2026-09-05T09:00:00Z',state:'current',news:{state:'partial',items:[{...base,kind:'news',category:'Israel update'}],gaps:[]},fakeResistance:{state:'partial',items:[{...base,key:'w',kind:'watch',claim:'An unresolved claim',verification:'unresolved',basis:'analysis'}],gaps:[]},october7:empty,heroes:empty,israelsStory:empty};}
describe('homepage editorial composition',()=>{
 it('renders the journey in semantic order without carousel or autoplay below hero',()=>{
 const html=renderToStaticMarkup(<HomepageJourney edition={edition()}/>);
 /* heroes and israelsStory no longer have their own top-level section: since
  * 2026-09-06 both render as collections inside the "people" chapter
  * (`HomePeopleSection`), so the semantic-order check names only the bands
  * that still carry their own `data-home-section`. */
 const names=['news','fakeResistance','october7','people','system','support'];
 const indices=names.map(n=>html.indexOf(`data-home-section="${n}"`));expect([...indices].sort((a,b)=>a-b)).toEqual(indices);expect(indices.every(i=>i>=0)).toBe(true);
 expect(html).not.toContain('<video');expect(html).not.toContain('aria-roledescription="carousel"');expect(html).toContain('A full headline');expect(html).not.toContain('<h1');
 });
 it('shows status before claim and does not call an unsourced analysis a source-backed finding',()=>{
 const html=renderToStaticMarkup(<HomepageJourney edition={edition()}/>);
 expect(html.indexOf('Unresolved')).toBeLessThan(html.indexOf('An unresolved claim'));
 /* The status line says it once; an unresolved record with no finding excerpt carries no finding block repeating it. */
 expect(html.match(/no finding has been reached/gi)).toHaveLength(1);expect(html).not.toContain('Monitoring is not confirmation');
 /* UX-05: a sourced claim record says "See the evidence"; this fixture is an analysis that cites nothing, and the card keeps it honest — there is no evidence to see, so it is read as an assessment. */
 expect(html).toContain('Lions of Zion editorial analysis');expect(html).toContain('Read the assessment');expect(html).not.toContain('See the evidence');expect(html).not.toContain('Read the sources');
 });
 it('names the destinations as the site names them and keeps one action per section after its records',()=>{
 const html=renderToStaticMarkup(<HomepageJourney edition={edition()}/>);
 expect(html).toContain('Fake Resistance');
 /* UX-05: one form for "go to the whole section" — "All of <Section>" with
    the journey arrow. (VA-63 had settled on "View all"; the verb table
    replaced it, and "Explore" stays retired.) */
 expect(html).toContain('All of Fake Resistance');expect(html).not.toContain('View all');expect(html).not.toContain('Explore the investigations');expect(html).not.toContain('Explore Fake Resistance');
 const news=html.slice(html.indexOf('data-home-section="news"'),html.indexOf('data-home-section="fakeResistance"'));
 expect(news.indexOf('A full headline')).toBeLessThan(news.indexOf('All of News &amp; Analysis'));
 expect(news.match(/All of News &amp; Analysis/g)).toHaveLength(1);
 expect(html).toContain('data-rank="lead"');
 });
 it('dates a revised record by its revision, said as Updated, and an unrevised one by its publication',()=>{
 const e=edition();e.news.items[0]={...e.news.items[0],updatedAt:'2026-09-05T14:07:00Z'};
 const html=renderToStaticMarkup(<HomepageJourney edition={e}/>);
 const news=html.slice(html.indexOf('data-home-section="news"'),html.indexOf('data-home-section="fakeResistance"'));
 expect(news).toContain('dateTime="2026-09-05T14:07:00.000Z"');
 expect(news).toContain('Updated 5 Sept 2026, 17:07 · Israel time');
 expect(news).not.toContain('5 Sept 2026, 12:00');
 /* Same instant on both stamps, or no revision at all: no "Updated". */
 const same=edition();same.news.items[0]={...same.news.items[0],updatedAt:'2026-09-05T09:00:00.000Z'};
 const plain=renderToStaticMarkup(<HomepageJourney edition={same}/>);
 expect(plain).not.toContain('Updated ');expect(plain).toContain('5 Sept 2026, 12:00 · Israel time');
 expect(renderToStaticMarkup(<HomepageJourney edition={edition()}/>)).not.toContain('Updated ');
 });
 it('derives the contents line from HOMEPAGE_BANDS, in band order, and names the edition by its day',()=>{
 const html=renderToStaticMarkup(<HomepageJourney edition={edition()}/>);
 const nav=html.slice(html.indexOf('aria-label="In this edition"'),html.indexOf('</nav>'));
 const anchors=[...nav.matchAll(/href="(#[^"]+)"/g)].map(m=>m[1]);
 expect(anchors).toEqual(HOMEPAGE_BANDS.map(b=>b.anchor));
 /* Every anchor lands on a section that exists, in the same order. */
 const targets=anchors.map(a=>html.indexOf(`id="${a.slice(1)}"`));
 expect(targets.every(i=>i>=0)).toBe(true);expect([...targets].sort((a,b)=>a-b)).toEqual(targets);
 for(const band of HOMEPAGE_BANDS)expect(nav).toContain(`>${band.label.replace('&','&amp;')}<`);
 /* One edition date, in the cover's words, never the raw ISO. */
 expect(html).toContain('Edition · Sat 5 Sept 2026');expect(html).not.toContain('Edition 2026-09-05');
 const previous=edition();previous.state='previous-edition';
 expect(renderToStaticMarkup(<HomepageJourney edition={previous}/>)).toContain('Edition · Sat 5 Sept 2026 · Previous edition');
 });
 it('keeps a record without a picture on the page, text-led, with no empty frame',()=>{
 const e=edition();e.news.items[0]={...e.news.items[0],media:null};
 const html=renderToStaticMarkup(<HomepageJourney edition={e}/>);
 const news=html.slice(html.indexOf('data-home-section="news"'),html.indexOf('data-home-section="fakeResistance"'));
 expect(news).toContain('A full headline');expect(news).not.toContain('<figure');expect(news).not.toContain('<img');
 });
 it('puts the image disclosure first in the caption and keeps the full alt text',()=>{
 const illustration={...asset,role:'editorial-illustration' as const,caption:'A description.',alt:'Editorial illustration. Not evidence.'};
 const e=edition();e.news.items[0]={...e.news.items[0],media:illustration};
 const html=renderToStaticMarkup(<HomepageJourney edition={e}/>);
 const caption=html.slice(html.indexOf('<figcaption'),html.indexOf('</figcaption>'));
 expect(caption.indexOf('Editorial illustration — not evidence')).toBeLessThan(caption.indexOf('A description.'));
 expect(html).toContain('alt="Editorial illustration. Not evidence."');
 });
 it('retains contested context and distinguishes publication provenance paths',()=>{
  const e=edition();e.israelsStory={state:'partial',gaps:[],items:[{...base,kind:'chapter',era:'1993',contested:true}]};
 const html=renderToStaticMarkup(<HomepageJourney edition={e}/>);expect(html).toContain('Contested');expect(html).toContain('different provenance and review paths');
 });
 it('contains failures to selected records, keeping the other preview readable',async()=>{
 const refs=[{id:'ok',key:'ok'},{id:'failure',key:'failure'}] as HomeReference[];
 const result=await resolveHomepageSection(refs,async r=>{if(r.id==='failure')throw Error('offline');return {...base,kind:'news',category:'Israel update'} as HomePreview});
 expect(result.state).toBe('partial');expect(result.items).toHaveLength(1);expect(result.gaps).toEqual(['failure']);
 });
 it('distinguishes empty from unavailable and never fabricates a second story',async()=>{
 expect((await resolveHomepageSection([])).state).toBe('empty');
 expect((await resolveHomepageSection([{key:'withdrawn'} as HomeReference],async()=>null)).state).toBe('unavailable');
 });
});
