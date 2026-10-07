import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

// Synthetic data only; these checks never log in or write to production.
const api='https://westar-proposal-api.tomben49999999.workers.dev';
const fixtureStatus=i=>i===0?'rejected':i===1?'cooling':i===2?'sent':i===3?'waiting':'review';
const proposals=Array.from({length:40},(_,i)=>({proposal_id:`fixture-${i}`,title:`測試提案 ${i} — 完整長標題與合作活動`.repeat(i===39?5:1),account:'Fixture',status:fixtureStatus(i),version:1,created_at:new Date(Date.UTC(2026,8,1+i)).toISOString(),updated_at:new Date(Date.UTC(2026,10,40-i)).toISOString()}));
let server,browser,origin;
test.before(async()=>{
 server=createServer(async(req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
  if(!['index.html','app.js','style.css','config.js'].includes(name)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');
  res.end(await readFile(new URL('../web/'+name,import.meta.url)));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 origin=process.env.PROPOSAL_DESK_URL||`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{});
});
test.after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve));});
async function pageAt(width){
 const page=await browser.newPage({viewport:{width,height:800}});
 await page.addInitScript(()=>localStorage.setItem('westar.session.v1','synthetic-fixture'));
 await page.route(api+'/**',route=>{
  const path=new URL(route.request().url()).pathname;
  const p=proposals.find(p=>path.endsWith('/'+p.proposal_id));
  return route.fulfill({json:p?{proposal:{...p,content:'Long proposal paragraph.\n\n'.repeat(100),history:[],mail:{to:'fixture@example.invalid',subject:'Fixture subject',body:'Fixture body',...(['sent','waiting'].includes(p.status)?{sent_at:'2026-10-07T00:00:00Z'}:{})}}}:{member:{email:'fixture@example.invalid',role:'viewer'},proposals,fetched_at:'2026-10-07T00:00:00Z'}});
 });
 await page.goto(origin);
 await page.locator('.nav-item').last().waitFor({state:'attached'});
 assert.deepEqual(await page.locator('.nav-item').allTextContents(),proposals.slice().reverse().map(p=>p.title));
 return page;
}
async function scrollState(page){return page.evaluate(()=>{
 const nav=document.getElementById('nav-list'),header=document.querySelector('header'),pane=document.getElementById('content-pane');
 return {y:scrollY,paneScroll:pane.scrollTop,paneOverflow:getComputedStyle(pane).overflowY,rootOverflow:document.documentElement.scrollHeight>innerHeight,navScroll:nav.scrollTop,overflow:getComputedStyle(nav).overflowY,headerTop:header.getBoundingClientRect().top,navHeight:nav.clientHeight,navContent:nav.scrollHeight,wide:document.documentElement.scrollWidth>innerWidth};
});}
test('desktop and tablet: content scrolls independently while navigation stays fixed',async()=>{
 for(const [width,height] of [[1440,800],[900,500],[701,320]]){
  const page=await pageAt(width);await page.setViewportSize({width,height});
  const before=await scrollState(page);
  assert.equal(await page.locator('.nav-item').evaluateAll(items=>items.every((item,i)=>item.scrollHeight<=item.clientHeight+1&&(!i||item.getBoundingClientRect().top>=items[i-1].getBoundingClientRect().bottom))),true,'Long navigation labels must fit their rows without overlapping');
  assert.equal(before.wide,false);assert.equal(before.rootOverflow,false);assert.equal(before.paneOverflow,'auto');
  await page.mouse.move(width-100,200);await page.mouse.wheel(0,700);
  await page.waitForFunction(()=>document.getElementById('content-pane').scrollTop>100);
  const after=await scrollState(page);
  assert.equal(after.y,0);assert.equal(after.navScroll,0);assert.equal(after.headerTop,before.headerTop);
  await page.locator('.nav-item').last().click();
  await page.locator('#detail').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.getElementById('content-pane').scrollTop===0);
  assert.equal(await page.locator('#status').isDisabled(),true);
  const detailBefore=await scrollState(page);
  await page.mouse.move(width-100,200);await page.mouse.wheel(0,700);
  await page.waitForFunction(()=>document.getElementById('content-pane').scrollTop>100);
  const detailAfter=await scrollState(page);
  assert.equal(detailAfter.y,0);assert.equal(detailAfter.headerTop,detailBefore.headerTop);assert.equal(detailAfter.navScroll,detailBefore.navScroll);
  if(process.env.UI_SCREENSHOT_DIR&&width===1440)await page.screenshot({path:process.env.UI_SCREENSHOT_DIR+'/desktop-fixed.png'});
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
  const state=await scrollState(page);assert.equal(state.overflow,'visible');assert.equal(state.paneOverflow,'visible');assert.equal(state.paneScroll,0);assert.equal(state.wide,false);
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
test('proposal mail actions respect decision status',async()=>{
 const page=await pageAt(1440);
 const cases=[
  ['fixture-0',false,false],
  ['fixture-1',false,false],
  ['fixture-2',true,false],
  ['fixture-3',true,false],
  ['fixture-4',true,true]
 ];
 for(const [id,panelVisible,actionable] of cases){
  await page.evaluate(id=>{location.hash=id;},id);
  await page.locator('#detail').waitFor({state:'visible'});
  assert.equal(await page.locator('#mail-panel').isVisible(),panelVisible,id+' panel visibility');
  if(panelVisible){
   assert.equal(await page.locator('#mailto').isVisible(),actionable,id+' mailto visibility');
   assert.equal(await page.locator('#copy').isVisible(),actionable,id+' copy visibility');
   const href=await page.locator('#mailto').getAttribute('href');
   assert.equal(actionable?href?.startsWith('mailto:'):href===null,true,id+' mailto action');
  }
 }
 await page.close();
});

test('detail export button opens print flow and print media removes app chrome',async()=>{
 const page=await pageAt(1440);
 await page.locator('.nav-item').first().click();
 await page.locator('#detail').waitFor({state:'visible'});
 assert.equal(await page.locator('#export-pdf').isVisible(),true);
 await page.evaluate(()=>{window.__printCalled=false;window.print=()=>{window.__printCalled=true;window.dispatchEvent(new Event('afterprint'));};});
 const originalTitle=await page.title();
 await page.locator('#export-pdf').click();
 assert.equal(await page.evaluate(()=>window.__printCalled),true);
 assert.equal(await page.title(),originalTitle);
 await page.emulateMedia({media:'print'});
 assert.equal(await page.locator('header').evaluate(el=>getComputedStyle(el).display),'none');
 assert.equal(await page.locator('#detail').evaluate(el=>getComputedStyle(el).display),'block');
 assert.equal(await page.locator('.detail-controls').evaluate(el=>getComputedStyle(el).display),'none');
 assert.equal(await page.locator('#export-pdf').isVisible(),false);
 assert.equal(await page.locator('#mail-panel').evaluate(el=>getComputedStyle(el).display),'none');
 assert.equal(await page.locator('#body').evaluate(el=>getComputedStyle(el).color),'rgb(17, 17, 17)');
 await page.close();
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
