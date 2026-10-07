import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

// Synthetic data only; these checks never log in or write to production.
const api='https://westar-proposal-api.tomben49999999.workers.dev';
const proposals=Array.from({length:40},(_,i)=>({proposal_id:`fixture-${i}`,title:`測試提案 ${i} — 完整長標題與合作活動`,account:'Fixture',status:'review',version:1,created_at:'2026-10-07T00:00:00Z',updated_at:'2026-10-07T00:00:00Z'}));
let server,browser,origin;
test.before(async()=>{
 server=createServer(async(req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
  if(!['index.html','app.js','style.css','config.js'].includes(name)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');
  res.end(await readFile(new URL('../web/'+name,import.meta.url)));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{});
});
test.after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve));});
async function pageAt(width){
 const page=await browser.newPage({viewport:{width,height:800}});
 await page.addInitScript(()=>localStorage.setItem('westar.session.v1','synthetic-fixture'));
 await page.route(api+'/**',route=>{
  const path=new URL(route.request().url()).pathname;
  const p=proposals.find(p=>path.endsWith('/'+p.proposal_id));
  return route.fulfill({json:p?{proposal:{...p,content:'Long proposal paragraph.\n\n'.repeat(100),history:[]}}:{member:{email:'fixture@example.invalid',role:'viewer'},proposals,fetched_at:'2026-10-07T00:00:00Z'}});
 });
 await page.goto(origin);
 await page.locator('.nav-item').last().waitFor({state:'attached'});
 return page;
}
async function scrollState(page){return page.evaluate(()=>{
 const nav=document.getElementById('nav-list'),header=document.querySelector('header');
 return {y:scrollY,navScroll:nav.scrollTop,overflow:getComputedStyle(nav).overflowY,headerTop:header.getBoundingClientRect().top,navHeight:nav.clientHeight,navContent:nav.scrollHeight,wide:document.documentElement.scrollWidth>innerWidth};
});}
test('desktop and tablet: long navigation belongs to the document scroll',async()=>{
 for(const width of [1440,900,701]){
  const page=await pageAt(width);
  if(process.env.UI_SCREENSHOT_DIR&&width===1440)await page.screenshot({path:process.env.UI_SCREENSHOT_DIR+'/desktop.png'});
  const before=await scrollState(page);
  assert.equal(before.overflow,'visible');assert.equal(before.wide,false);assert.ok(before.navHeight>=before.navContent);
  await page.mouse.move(100,300);await page.mouse.wheel(0,700);
  await page.waitForFunction(()=>scrollY>100);
  const after=await scrollState(page);
  assert.equal(after.navScroll,0);assert.ok(after.headerTop<before.headerTop);
  await page.locator('.nav-item').last().click();
  await page.locator('#detail').waitFor({state:'visible'});
  await page.waitForFunction(()=>scrollY===0);
  assert.equal(await page.locator('#status').isDisabled(),true);
  await page.close();
 }
});
test('mobile drawer: document scroll reaches every item, selection and Escape close it',async()=>{
 for(const width of [390,320]){
  const page=await pageAt(width);
  assert.equal(await page.locator('#nav-list').isVisible(),false);
  await page.evaluate(()=>scrollTo(0,350));
  await page.evaluate(()=>document.getElementById('menu').click());
  assert.equal(await page.locator('#menu').getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('main').evaluate(el=>el.inert),true);
  if(process.env.UI_SCREENSHOT_DIR&&width===390)await page.screenshot({path:process.env.UI_SCREENSHOT_DIR+'/mobile.png'});
  const state=await scrollState(page);assert.equal(state.overflow,'visible');assert.equal(state.wide,false);
  await page.mouse.move(100,300);await page.mouse.wheel(0,650);await page.waitForFunction(()=>scrollY>100);
  assert.equal((await scrollState(page)).navScroll,0);
  await page.locator('.nav-item').last().click();
  await page.locator('#detail').waitFor({state:'visible'});
  assert.equal(await page.locator('#menu').getAttribute('aria-expanded'),'false');
  await page.waitForFunction(()=>scrollY===0);
  await page.locator('#menu').click();await page.keyboard.press('Escape');
  assert.equal(await page.locator('#nav-list').isVisible(),false);
  await page.locator('#menu').click();
  await page.mouse.click(width-10,300);
  assert.equal(await page.locator('#menu').getAttribute('aria-expanded'),'false');
  await page.locator('#menu').click();await page.setViewportSize({width:1000,height:800});
  await page.waitForFunction(()=>!document.body.classList.contains('mobile-nav-open'));
  assert.equal(await page.locator('main').evaluate(el=>el.inert),false);
  await page.close();
 }
});
test('frontend CSP blocks injected inline scripts and foreign connections; login popup still opens',async()=>{
 const page=await browser.newPage();await page.goto(origin);
 await page.evaluate(()=>{const s=document.createElement('script');s.textContent='window.unsafeScriptRan=true';document.body.append(s);});
 assert.equal(await page.evaluate(()=>window.unsafeScriptRan),undefined);
 assert.equal(await page.evaluate(async()=>{try{await fetch('https://example.invalid/leak');return false;}catch{return true;}}),true);
 await page.context().route(api+'/**',route=>route.fulfill({contentType:'text/html',body:'Authentication fixture'}));
 const popupPromise=page.waitForEvent('popup');await page.locator('#signin').click();
 const popup=await popupPromise;await popup.waitForLoadState();
 assert.equal(new URL(popup.url()).origin,api);
 assert.equal(new URL(popup.url()).pathname,'/auth/start');
 await page.close();await popup.close();
});
