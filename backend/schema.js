export const statuses = new Set(['review','sent','waiting','rejected','cooling']);
export function validateProposal(p){
 if(!p||typeof p!=='object'||Array.isArray(p))throw new Error('Proposal object required');
 if(p.marker!=='WESTAR_PROPOSAL'||p.source?.role!=='assistant'||p.source?.kind!=='final_proposal'||p.source?.action!=='publish')throw new Error('Only explicitly published formal assistant proposals are accepted');
 if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(p.proposal_id))throw new Error('Invalid proposal_id');
 for(const k of ['account','title','content','created_at','updated_at'])if(typeof p[k]!=='string'||!p[k].trim())throw new Error(`Missing ${k}`);
 for(const k of ['created_at','updated_at'])if(!/^\d{4}-\d\d-\d\dT/.test(p[k])||!Number.isFinite(Date.parse(p[k])))throw new Error(`Invalid ${k}`);
 if(!statuses.has(p.status)||!Number.isSafeInteger(p.version)||p.version<1)throw new Error('Invalid version/status');
 if(!p.source.message_id||!p.source.conversation_id||!p.source.sha256?.match(/^[a-f0-9]{64}$/))throw new Error('Source provenance is required');
 if(!p.mail||typeof p.mail!=='object'||Array.isArray(p.mail))throw new Error('Mail state is required');
 if(p.mail.available===false){if(typeof p.mail.reason!=='string'||!p.mail.reason.trim())throw new Error('Unavailable mail requires a reason');}
 else if(!p.mail.to?.match(/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/)||typeof p.mail.body!=='string'||!p.mail.subject||/[\r\n]/.test(p.mail.subject))throw new Error('Invalid prepared mail');
 if(!Array.isArray(p.history)||!p.history.length||p.history.at(-1).version!==p.version)throw new Error('Version history required');
 for(const key of ['conversation','turns','messages','tool_output','user_message'])if(key in p)throw new Error('Conversation payloads are forbidden');
 return p;
}
export async function verifyContentHash(p){const bytes=new TextEncoder().encode(p.content);const sum=await crypto.subtle.digest('SHA-256',bytes);const hex=Array.from(new Uint8Array(sum),x=>x.toString(16).padStart(2,'0')).join('');if(hex!==p.source.sha256)throw new Error('Proposal original text hash mismatch');return p;}
