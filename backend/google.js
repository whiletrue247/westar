import {createRemoteJWKSet,jwtVerify} from 'jose';
import {ApiError} from './repository.js';
import {state,hash,random,session} from './auth.js';
const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const base64url=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const callback=env=>env.API_ORIGIN+'/auth/google/callback';
export async function googleStart(req,env){
 if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET)throw new ApiError(503,'Google 登入尚未完成配置。');
 const appState=new URL(req.url).searchParams.get('state');if(!appState?.match(/^[a-f0-9-]{36}$/))throw new ApiError(400,'請從工作台開啟登入。');
 const oauthState=random(),codeVerifier=random().replaceAll('-',''),cookie=random(),nonce=random();
 const codeChallenge=base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(codeVerifier))));
 await state(env,'put','oauth:'+oauthState,{appState,codeVerifier,nonce,cookieHash:await hash(cookie),expires:Date.now()+600000});
 const target=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 for(const [key,value] of Object.entries({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:callback(env),response_type:'code',scope:'openid email',state:oauthState,nonce,code_challenge:codeChallenge,code_challenge_method:'S256',prompt:'select_account'}))target.searchParams.set(key,value);
 return new Response(null,{status:302,headers:{Location:target.href,'Set-Cookie':`__Host-westar-oauth=${cookie}; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
export async function verifyGoogleIdentity(idToken,env,nonce,keySet=jwks){
 const {payload}=await jwtVerify(idToken,keySet,{issuer:['https://accounts.google.com','accounts.google.com'],audience:env.GOOGLE_CLIENT_ID,algorithms:['RS256']});
 if(payload.nonce!==nonce||payload.email_verified!==true||typeof payload.email!=='string'||!payload.sub)throw new Error('Google identity is unverified');
 return payload.email.toLowerCase();
}
export async function googleCallback(req,env,repo){
 if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET)throw new ApiError(503,'Google 登入尚未完成配置。');
 const url=new URL(req.url),oauthState=url.searchParams.get('state');if(!oauthState||oauthState.length>100)throw new ApiError(400,'登入狀態不正確。');
 const expected=await state(env,'get','oauth:'+oauthState),cookie=req.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-westar-oauth='))?.slice('__Host-westar-oauth='.length);
 if(!expected||expected.expires<Date.now()||!cookie||cookie.length>100||await hash(cookie)!==expected.cookieHash)throw new ApiError(400,'登入已過期或不是同一個瀏覽器，請重新登入。');
 const flow=await state(env,'consume','oauth:'+oauthState);if(!flow)throw new ApiError(400,'此登入已使用，請重試。');
 if(url.searchParams.has('error'))throw new ApiError(403,'Google 登入已取消。');const code=url.searchParams.get('code');if(!code||code.length>4096)throw new ApiError(400,'Google 登入回應不正確。');
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,code,code_verifier:flow.codeVerifier,grant_type:'authorization_code',redirect_uri:callback(env)})});
 if(!response.ok)throw new ApiError(401,'Google 登入驗證失敗，請重試。');const tokens=await response.json();let email;try{email=await verifyGoogleIdentity(tokens.id_token,env,flow.nonce);}catch{throw new ApiError(401,'Google 身分驗證失敗。');}
 await repo.member(email);return {state:flow.appState,origin:env.FRONTEND_ORIGIN,token:await session(env,email)};
}
