import {startRegistration,startAuthentication} from '@simplewebauthn/browser';
const options=window.WESTAR_POPUP,$=id=>document.getElementById(id);let enrollToken=null;
function finish(type,data={}){if(window.opener){window.opener.postMessage({type,state:options.state,...data},options.origin);window.close();}else $('message').textContent='請關閉此視窗並返回工作台。';}
async function api(path,body,token){const r=await fetch('/api/passkey/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||'驗證失敗。');return d;}
if(options.token)finish('westar-auth',{token:options.token});
else{
 window.addEventListener('message',e=>{if(e.origin!==options.origin||e.source!==window.opener||e.data?.state!==options.state||e.data.type!=='westar-enroll')return;enrollToken=e.data.token;$('action').disabled=false;$('message').textContent='在此裝置建立 WESTAR Passkey。';});
 if(options.mode==='register'){ $('email-label').hidden=true;$('action').textContent='建立 Passkey';$('action').disabled=true;window.opener?.postMessage({type:'westar-ready',state:options.state},options.origin);}
 $('form').addEventListener('submit',async e=>{e.preventDefault();$('action').disabled=true;try{if(options.mode==='register'){const d=await api('register-options',{},enrollToken);const response=await startRegistration({optionsJSON:d.options});await api('register-verify',{challenge_id:d.challenge_id,response},enrollToken);finish('westar-enrolled');}else{const d=await api('login-options',{email:$('email').value});const response=await startAuthentication({optionsJSON:d.options});const result=await api('login-verify',{challenge_id:d.challenge_id,response});finish('westar-auth',result);}}catch(err){$('message').textContent=err.name==='NotAllowedError'?'驗證已取消，可再次重試。':err.message;}finally{$('action').disabled=false;}});
}
