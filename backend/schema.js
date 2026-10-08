// Proposal content is freeform. This module validates only the storage/security boundary,
// not the commercial reasoning, narrative structure, or AI's research method.
export const statuses=new Set(['review','sent','waiting','rejected','cooling']);
const idPattern=/^[a-z0-9][a-z0-9-]{2,79}$/;
const forbidden=['conversation','turns','messages','tool_output','user_message'];
export function validateProposal(p){
 if(!p||typeof p!=='object'||Array.isArray(p))throw new Error('Proposal object required');
 if(!idPattern.test(p.proposal_id||''))throw new Error('Invalid proposal_id');
 if(typeof p.content!=='string'||!p.content.trim())throw new Error('Non-empty Proposal content required');
 for(const key of forbidden)if(Object.prototype.hasOwnProperty.call(p,key))throw new Error('Conversation payloads are forbidden');
 for(const key of ['account','title','created_at','updated_at'])
  if(p[key]!==undefined&&typeof p[key]!=='string')throw new Error('Invalid '+key);
 if(p.version!==undefined&&(!Number.isSafeInteger(p.version)||p.version<1))throw new Error('Invalid version');
 if(p.status!==undefined&&!statuses.has(p.status))throw new Error('Invalid status');
 if(p.mail!==undefined&&(typeof p.mail!=='object'||p.mail===null||Array.isArray(p.mail)))throw new Error('Invalid mail metadata');
 if(p.history!==undefined&&!Array.isArray(p.history))throw new Error('Invalid history');
 return p;
}
export function normalizeProposal(p){
 validateProposal(p);
 const heading=p.content.match(/^\s*#\s+(.+)$/m)?.[1]?.trim();
 const title=p.title?.trim()||heading||p.proposal_id;
 return {...p,title,account:p.account?.trim()||title,
  created_at:p.created_at||'',updated_at:p.updated_at||p.created_at||'',
  version:p.version||1,status:p.status||'review',
  mail:p.mail||{available:false},history:p.history||[]};
}
// Optional legacy diagnostic only; never a prerequisite for rendering or judging a Proposal.
export async function verifyContentHash(p){
 if(!p.source?.sha256)return p;
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p.content));
 const hex=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
 if(hex!==p.source.sha256)throw new Error('Proposal text hash mismatch');
 return p;
}
