/** Local-only visual and interaction evidence. Never claims a physical-device test. */
import { chromium, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const root='docs/reviews/homepage-editorial-journey/after';
await mkdir(root,{recursive:true});
const report={origin:'http://localhost:3000',viewportHeight:1000,device:'Desktop browser viewport emulation, not a phone',runs:[]};
async function inspect(browserType,name,widths){
 let browser;try{browser=await browserType.launch({headless:true})}catch(error){report.runs.push({browser:name,unavailable:String(error).split('\n')[0]});return;}
 for(const width of widths){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.addInitScript(()=>{window.__metrics={cls:0,lcp:0};new PerformanceObserver(l=>l.getEntries().forEach(e=>{if(!e.hadRecentInput)window.__metrics.cls+=e.value})).observe({type:'layout-shift',buffered:true});new PerformanceObserver(l=>{window.__metrics.lcp=l.getEntries().at(-1).startTime}).observe({type:'largest-contentful-paint',buffered:true});});
  await page.goto(report.origin,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
  const keys=await page.locator('[data-home-record]').evaluateAll(els=>els.map(e=>e.dataset.homeRecord));
  for(const section of await page.locator('[data-home-section]').all()){
   await section.scrollIntoViewIfNeeded();await page.waitForTimeout(350);
   await section.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode().catch(()=>{}))));
  }
  await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(300);
  await page.screenshot({path:`${root}/${name}-home-${width}-full.png`,fullPage:true});
  await page.screenshot({path:`${root}/${name}-home-${width}-hero.png`});
  for(const nameOfSection of ['news','fakeResistance','october7','heroes','israelsStory','system']){
   await page.locator(`[data-home-section="${nameOfSection}"]`).evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY-92));await page.waitForTimeout(100);
   await page.screenshot({path:`${root}/${name}-home-${width}-${nameOfSection}.png`});
  }
  const layout=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,main:document.querySelectorAll('main').length,h1:document.querySelectorAll('h1').length,images:[...document.querySelectorAll('[data-home-section] img')].map(i=>({src:i.currentSrc,loaded:i.complete&&i.naturalWidth>0,lazy:i.loading==='lazy'})),metrics:window.__metrics,askPosition:getComputedStyle(document.querySelector('[aria-label*="Ask"]')??document.body).position}));
  await page.evaluate(()=>window.scrollTo(0,0));await page.keyboard.press('Tab');const firstFocus=await page.evaluate(()=>document.activeElement?.textContent);
  await page.keyboard.press('Enter');const skipTarget=await page.evaluate(()=>location.hash);
  const article=page.locator('[data-home-section="news"] h3 a').first();await article.click();await page.waitForURL('**/articles/**');await page.goBack({waitUntil:'networkidle'});
  const returnKeys=await page.locator('[data-home-record]').evaluateAll(els=>els.map(e=>e.dataset.homeRecord));
  report.runs.push({browser:name,width,keys,layout,errors,firstFocus,skipTarget,backMembershipStable:JSON.stringify(keys)===JSON.stringify(returnKeys),archiveRawRequests:requests.filter(u=>/\/(october7|hamas-massacre)\/.*\.(mp4|jpg|png|webm)/i.test(u))});
  await context.close();
 }
 await browser.close();
}
await inspect(chromium,'chromium',[390,768,1024,1440,1920]);
await inspect(webkit,'webkit',[390,1440]);
const browser=await chromium.launch({headless:true});const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:1000}});const p=await context.newPage();await p.goto(report.origin,{waitUntil:'networkidle'});report.noJS={records:await p.locator('[data-home-record]').count(),main:await p.locator('main').count(),nav:await p.locator('noscript a').count()};await p.screenshot({path:`${root}/chromium-home-390-no-js.png`,fullPage:true});await browser.close();
await writeFile(`${root}/browser-results.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
