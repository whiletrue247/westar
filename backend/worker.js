import {Repository,ApiError} from './repository.js';
import {session,authenticated,passkey,state,hash} from './auth.js';
import {googleStart,googleCallback} from './google.js';
import popupScript from './generated/popup.js';
export {AuthStore} from './auth.js';
const baseHeaders={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"};
function json(data,status=200,headers={}){return Response.json(data,{status,headers:{...baseHeaders,...headers}});}
function html(options){const safe=JSON.stringify(options).replace(/</g,'\\u003c');const nonce=crypto.randomUUID().replaceAll('-','');return new Response(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WESTAR · 身分驗證</title><style nonce="${nonce}">body{background:#f5f5ef;color:#202720;font:16px/1.8 system-ui;max-width:420px;margin:70px auto;padding:24px}h1{font-size:32px}input,button{font:inherit;padding:12px;margin:12px 0;width:100%;box-sizing:border-box;border:1px solid #dce0d5;border-radius:6px}button{background:#365a3a;color:white;cursor:pointer}label{display:block}p{color:#687267}</style><h1>WESTAR</h1><p>Proposal Desk · 身分驗證</p><form id="form"><label id="email-label">受邀 Email<input id="email" type="email" autocomplete="username webauthn"></label><button id="action" type="submit">使用 Passkey 登入</button></form><p id="message" role="status">請使用 Touch ID、Face ID 或您的裝置解鎖。</p><script nonce="${nonce}">window.WESTAR_POPUP=${safe}</script><script nonce="${nonce}" src="/passkey-ui.js"></script></html>`,{headers:{...baseHeaders,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':`default-src 'none'; script-src 'self' 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'`}});}
export default{
 async fetch(req,env){const url=new URL(req.url),origin=req.headers.get('Origin'),allowed=env.FRONTEND_ORIGIN||'https://whiletrue247.github.io';const cors=origin===allowed?{'Access-Control-Allow-Origin':allowed,'Vary':'Origin','Access-Control-Allow-Methods':'GET, POST, PATCH, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600'}:{};
 try{
 if(origin&&origin!==allowed&&origin!==url.origin)return json({error:'來源不允許。'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...baseHeaders,...cors}});
 if(url.pathname==='/health'&&req.method==='GET')return json({ok:true,auth_configured:!!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET)},200,cors);
 if(url.pathname==='/passkey-ui.js'&&req.method==='GET')return new Response(popupScript,{headers:{...baseHeaders,'Content-Type':'application/javascript; charset=utf-8'}});
 const repo=new Repository(env);
 if(url.pathname==='/auth/start'&&req.method==='GET')return await googleStart(req,env);
 if(url.pathname==='/auth/google/callback'&&req.method==='GET'){const response=html(await googleCallback(req,env,repo));response.headers.set('Set-Cookie','__Host-westar-oauth=; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');return response;}
 if(url.pathname==='/passkey'&&req.method==='GET'){const stateValue=url.searchParams.get('state');if(!stateValue?.match(/^[a-f0-9-]{36}$/))throw new ApiError(400,'請從工作台開啟登入。');return html({state:stateValue,origin:allowed,mode:url.searchParams.get('mode')==='register'?'register':'login'});}
 if(url.pathname.startsWith('/api/passkey/')&&req.method==='POST'){if(Number(req.headers.get('Content-Length')||0)>32768)throw new ApiError(413,'請求過大。');const raw=await req.text();if(raw.length>32768)throw new ApiError(413,'請求過大。');const route=url.pathname.slice('/api/passkey/'.length);if(route.startsWith('login-')){const ok=await state(env,'rate','rate:'+await hash(req.headers.get('CF-Connecting-IP')||'local'));if(!ok)throw new ApiError(429,'請稍後再試。');}return json(await passkey(route,JSON.parse(raw),env,repo,req),200,cors);}
 if(!url.pathname.startsWith('/api/'))throw new ApiError(404,'找不到此頁面。');
 const auth=await authenticated(req,env,repo);
 if(url.pathname==='/api/logout'&&req.method==='POST'){await state(env,'delete','session:'+await hash(auth.token));return json({ok:true},200,cors);}
 if(url.pathname==='/api/proposals'&&req.method==='GET')return json({member:auth.member,proposals:await repo.list(),fetched_at:new Date().toISOString()},200,cors);
 const match=url.pathname.match(/^\/api\/proposals\/([a-z0-9][a-z0-9-]{2,79})(\/status)?$/);
 if(match&&!match[2]&&req.method==='GET')return json({proposal:(await repo.proposal(match[1])).value},200,cors);
 if(match&&match[2]&&req.method==='PATCH'){const raw=await req.text();if(raw.length>1024)throw new ApiError(413,'請求過大。');return json({proposal:await repo.status(match[1],JSON.parse(raw),auth.member)},200,cors);}
 throw new ApiError(404,'找不到此操作。');
 }catch(e){return json({error:e instanceof ApiError?e.message:e instanceof SyntaxError?'請求格式錯誤。':'服務暫時無法使用。'},e instanceof ApiError?e.status:e instanceof SyntaxError?400:503,cors);}
 }
};
