import {config} from '../config.js';
// WESTAR NEXT: Public code only. Proposal content is fetched only after authenticated API access.
const $=id=>document.getElementById(id);
const statusNames={review:'待審核',sent:'已寄出',waiting:'等待回覆',rejected:'不採用',cooling:'冷卻中'};
const sessionKey='westar.session.v1';
let token=localStorage.getItem(sessionKey),member=null,proposals=[],selected=null,pending=null,serial=0,raw=false;
const label=id=>statusNames[id]||id||'待審核';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;};
const displayDate=value=>{const n=Date.parse(value||'');return Number.isFinite(n)?new Date(n).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}):'—';};
function notice(text){$('notice').textContent=text||'';}
function show(which){for(const name of ['login','desk','detail'])$(name).hidden=name!==which;}
function closeMenu(){$('sidebar').classList.remove('open');$('shade').classList.remove('open');$('menu').setAttribute('aria-expanded','false');}
function clearSession(){
 serial++;token=null;member=null;proposals=[];selected=null;pending=null;raw=false;
 localStorage.removeItem(sessionKey);$('identity').textContent='';$('nav').replaceChildren();$('nav-count').textContent='';
 $('logout').hidden=true;$('register').hidden=true;$('reader').replaceChildren();show('login');closeMenu();
}
async function api(path,options={}){
 if(!config.apiBase||!token)throw new Error('請先登入。');
 const r=await fetch(config.apiBase+path,{...options,cache:'no-store',headers:{Authorization:'Bearer '+token,...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
 if(r.status===401||r.status===403){clearSession();throw new Error(r.status===403?'帳號未受邀或權限已撤銷。':'登入已失效，請重新登入。');}
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(data.error||'服務暫時無法使用。');
 return data;
}
function renderLists(){
 const query=$('search').value.trim().toLocaleLowerCase();
 const filter=$('filter').value;
 const list=proposals.filter(p=>(!filter||p.status===filter)&&(!query||(String(p.account||'')+' '+String(p.title||'')).toLocaleLowerCase().includes(query)));
 $('nav-count').textContent=String(list.length)+' 份';
 $('nav').replaceChildren(...list.map(p=>{
  const item=el('button',undefined,'nav-item'+(location.hash.slice(1)===p.proposal_id?' active':''));
  item.append(el('strong',p.title||p.proposal_id),el('small',(p.account||'')+' · '+label(p.status)));
  item.onclick=()=>{location.hash=p.proposal_id;closeMenu();};
  return item;
 }));
 $('list').replaceChildren(...list.map(p=>{
  const item=el('button',undefined,'row'),copy=el('div',undefined,'row-copy');
  copy.append(el('div',p.account||'','account'),el('h2',p.title||p.proposal_id),el('div','更新 '+displayDate(p.updated_at)+' · v'+(p.version||1),'meta'));
  item.append(copy,el('span',label(p.status),'pill'));
  item.onclick=()=>{location.hash=p.proposal_id;};
  return item;
 }));
 $('empty').hidden=list.length!==0;
}
function inline(parent,input){
 const expression=/\*\*([^*\n]+)\*\*|\x60([^\x60\n]+)\x60|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
 let previous=0,match;
 while((match=expression.exec(input))){
  parent.append(document.createTextNode(input.slice(previous,match.index)));
  if(match[1])parent.append(el('strong',match[1]));
  else if(match[2])parent.append(el('code',match[2]));
  else {
   const a=el('a',match[3]);a.href=match[4];a.target='_blank';a.rel='noopener noreferrer';parent.append(a);
  }
  previous=expression.lastIndex;
 }
 parent.append(document.createTextNode(input.slice(previous)));
}
function visibleText(content){
 return String(content||'')
  .replace(/\ue200entity\ue202\[[^\n]*?,"([^"\n]+)"[^\n]*?\]\ue201/g,'$1')
  .replace(/\ue200url\ue202([^\ue202]+)\ue202(https?:\/\/[^\ue201]+)\ue201/g,'[$1]($2)')
  .replace(/\ue200[^\ue201\n]*\ue201/g,'')
  .replace(/:chatgpt-content-reference\{index="(\d+)"\}/g,'〔來源 $1〕');
}
function renderBody(content){
 const target=$('reader');
 target.classList.toggle('raw',raw);
 if(raw){target.textContent=content;return;}
 target.replaceChildren();
 const lines=visibleText(content).split(/\r?\n/);
 let para=[],list=null,code=null;
 const flush=()=>{if(para.length){const p=el('p');inline(p,para.join('\n'));target.append(p);para=[];}};
 const pushList=(ordered,text)=>{
  flush();
  if(!list||list.tagName.toLowerCase()!==(ordered?'ol':'ul')){
   list=el(ordered?'ol':'ul');target.append(list);
  }
  const li=el('li');inline(li,text);list.append(li);
 };
 for(const line of lines){
  if(/^\s*\x60{3}/.test(line)){
   flush();list=null;
   if(code){code=null;}else{const pre=el('pre');code=el('code');pre.append(code);target.append(pre);}
   continue;
  }
  if(code){code.textContent+=(code.textContent?'\n':'')+line;continue;}
  const heading=line.match(/^(#{1,4})\s+(.+)$/);
  if(heading){flush();list=null;const h=el('h'+heading[1].length);inline(h,heading[2]);target.append(h);continue;}
  const bullet=line.match(/^\s*[-*]\s+(.+)$/);
  const ordered=line.match(/^\s*\d+[.)]\s+(.+)$/);
  if(bullet||ordered){pushList(!!ordered,(bullet||ordered)[1]);continue;}
  const quote=line.match(/^>\s?(.*)$/);
  if(quote){flush();list=null;const block=el('blockquote');inline(block,quote[1]);target.append(block);continue;}
  if(/^\s*---+\s*$/.test(line)){flush();list=null;target.append(el('hr'));continue;}
  if(!line.trim()){flush();list=null;continue;}
  list=null;para.push(line);
 }
 flush();
}
function renderDetails(p){
 selected=p;raw=false;$('raw').textContent='查看原文';
 $('account').textContent=p.account||'';
 $('title').textContent=p.title||p.proposal_id;
 $('meta').textContent='更新 '+displayDate(p.updated_at)+' · v'+(p.version||1)+' · 建立 '+displayDate(p.created_at);
 $('status').value=p.status||'review';$('status').disabled=!['owner','reviewer'].includes(member?.role);
 renderBody(p.content);
 const entries=Array.isArray(p.history)?p.history:[];
 $('history').replaceChildren(...entries.slice().reverse().map(h=>el('p','v'+(h.version||'?')+' · '+displayDate(h.updated_at)+' · '+(h.kind==='status'?'進度變更':'提案更新'))));
 const mail=p.mail;const available=mail&&mail.available!==false&&mail.to&&mail.body;
 $('mail').hidden=!available;
 if(available){$('mail-recipient').textContent=mail.to;$('mail-subject').textContent=mail.subject||'';$('mail-body').textContent=mail.body;}
 show('detail');
 window.scrollTo({top:0,behavior:'instant'});
 renderLists();
}
async function route(){
 if(!member)return;
 const id=decodeURIComponent(location.hash.slice(1));
 if(!id){selected=null;show('desk');renderLists();return;}
 if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(id)){notice('提案識別碼不正確。');return;}
 const checkpoint=++serial;notice('');
 try{
  const data=await api('/api/proposals/'+encodeURIComponent(id));
  if(checkpoint!==serial)return;
  renderDetails(data.proposal);
 }catch(error){notice(error.message);}
}
async function load(){
 if(!token){show('login');return;}
 const checkpoint=++serial;notice('');
 try{
  const data=await api('/api/proposals');
  if(checkpoint!==serial)return;
  member=data.member;proposals=(data.proposals||[]).slice().sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at));
  $('identity').textContent=member.email+' · '+member.role;
  $('logout').hidden=false;$('register').hidden=false;
  $('status-line').textContent=proposals.length+' 份私人提案 · '+displayDate(data.fetched_at);
  show('desk');renderLists();await route();
 }catch(error){notice(error.message);}
}
function openAuth(kind){
 if(!config.apiBase){notice('登入服務目前無法使用。');return;}
 const state=crypto.randomUUID();
 const endpoint=kind==='email'?'/auth/start':'/passkey';
 const popup=window.open(config.apiBase+endpoint+'?state='+encodeURIComponent(state)+'&mode='+encodeURIComponent(kind),'westar-next-auth','width=550,height=720');
 if(!popup){notice('請允許本站開啟登入視窗。');return;}
 pending={state,popup,kind};notice('請在登入視窗完成驗證。');
}
window.addEventListener('message',async e=>{
 if(!pending||e.origin!==new URL(config.apiBase).origin||e.source!==pending.popup||e.data?.state!==pending.state)return;
 if(e.data.type==='westar-ready'&&pending.kind==='register'){
  e.source.postMessage({type:'westar-enroll',state:pending.state,token},e.origin);return;
 }
 if(e.data.type==='westar-enrolled'){pending=null;notice('Passkey 已建立。');return;}
 if(e.data.type!=='westar-auth'||typeof e.data.token!=='string'||e.data.token.length<20)return;
 token=e.data.token;localStorage.setItem(sessionKey,token);pending=null;await load();
});
$('signin').onclick=()=>openAuth('email');
$('passkey').onclick=()=>openAuth('login');
$('register').onclick=()=>openAuth('register');
$('refresh').onclick=()=>load();
$('search').oninput=renderLists;
$('filter').onchange=renderLists;
$('back').onclick=()=>{location.hash='';};
$('menu').onclick=()=>{const active=$('sidebar').classList.toggle('open');$('shade').classList.toggle('open',active);$('menu').setAttribute('aria-expanded',String(active));};
$('shade').onclick=closeMenu;
window.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
window.addEventListener('hashchange',()=>{closeMenu();route();});
$('raw').onclick=()=>{if(!selected)return;raw=!raw;$('raw').textContent=raw?'返回閱讀':'查看原文';renderBody(selected.content);};
$('print').onclick=()=>{if(selected)window.print();};
$('status').onchange=async()=>{
 if(!selected||!['owner','reviewer'].includes(member?.role))return;
 const previous=selected,value=$('status').value;
 $('status').disabled=true;
 try{
  const data=await api('/api/proposals/'+encodeURIComponent(previous.proposal_id)+'/status',{method:'PATCH',body:JSON.stringify({status:value,version:previous.version})});
  selected=data.proposal;
  proposals=proposals.map(item=>item.proposal_id===selected.proposal_id?{...item,status:selected.status,version:selected.version,updated_at:selected.updated_at}:item);
  renderDetails(selected);notice('審核狀態已保存。');
 }catch(error){$('status').value=previous.status;notice(error.message);}
 finally{$('status').disabled=!['owner','reviewer'].includes(member?.role);}
};
$('copy-mail').onclick=async()=>{try{await navigator.clipboard.writeText($('mail-body').textContent);notice('已複製預備信件。尚未寄出。');}catch{notice('複製失敗，請手動選取文字。');}};
$('logout').onclick=async()=>{
 const prior=token;clearSession();location.hash='';
 if(prior)fetch(config.apiBase+'/api/logout',{method:'POST',headers:{Authorization:'Bearer '+prior}}).catch(()=>{});
 notice('已登出。');
};
const savedTheme=localStorage.getItem('westar.next.theme');
if(savedTheme==='light')document.documentElement.dataset.theme='light';
function themeText(){$('theme').textContent=document.documentElement.dataset.theme==='light'?'深色':'淺色';}
themeText();
$('theme').onclick=()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='light'?'dark':'light';localStorage.setItem('westar.next.theme',document.documentElement.dataset.theme);themeText();};
if(token)load();else show('login');
