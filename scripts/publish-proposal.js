// Explicit publication of ONE formal assistant deliverable. Never accepts a conversation export.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {validateProposal} from '../backend/schema.js';
const [inputPath,repoPath]=process.argv.slice(2);
if(!inputPath||!repoPath){console.error('Usage: node scripts/publish-proposal.js <marked-deliverable.json> <private-repo-directory>');process.exit(1);}
const input=JSON.parse(await readFile(inputPath,'utf8'));
if(input.marker!=='WESTAR_PROPOSAL'||input.source?.role!=='assistant'||input.source?.kind!=='final_proposal'||input.source?.action!=='publish')throw new Error('Refusing unmarked output, draft, user message, or conversation.');
for(const k of ['conversation','turns','messages','tool_output','user_message'])if(k in input)throw new Error('Conversation exports are forbidden');
const repo=resolve(repoPath);let config;try{config=JSON.parse(await readFile(join(repo,'.westar-intel.json'),'utf8'));}catch{throw new Error('Destination must be the private westar-intel checkout');}
if(config.repository!=='whiletrue247/westar-intel'||config.visibility!=='private')throw new Error('Private destination required');
const digest=createHash('sha256').update(input.content,'utf8').digest('hex');
// The trusted publisher computes source.sha256; an explicitly supplied digest must still match.
if(input.source.sha256!==undefined&&input.source.sha256!==digest)throw new Error('Original text hash mismatch');
const file=join(repo,'proposals',input.proposal_id+'.json');let old;try{old=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const now=new Date().toISOString();if(old){validateProposal(old);if(input.expected_version!==old.version)throw new Error('Proposal changed: supply current expected_version');if(input.account!==old.account)throw new Error('Account identity cannot change');}
const mail=input.mail?.available===false?{...input.mail,to:input.mail.to||'archive@westar.invalid',subject:input.mail.subject||'No verified public email — archival placeholder',body:typeof input.mail.body==='string'?input.mail.body:'',available:false,archival_placeholder:true}:input.mail;
const p={marker:input.marker,proposal_id:input.proposal_id,account:input.account,title:input.title,created_at:old?.created_at||now,updated_at:now,version:(old?.version||0)+1,status:old?.status||input.status||'review',content:input.content,mail,source:{...input.source,sha256:digest},history:[...(old?.history||[]),{version:(old?.version||0)+1,updated_at:now,kind:'proposal',status:old?.status||input.status||'review',content_sha256:digest,source_message_id:input.source.message_id}]};
validateProposal(p);
let index;try{index=JSON.parse(await readFile(join(repo,'index.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;index={schema_version:1,proposal_ids:[]};}
if(!index.proposal_ids.includes(p.proposal_id))index.proposal_ids.push(p.proposal_id);
await mkdir(join(repo,'proposals'),{recursive:true});await writeFile(file,JSON.stringify(p,null,2)+'\n');await writeFile(join(repo,'index.json'),JSON.stringify(index,null,2)+'\n');console.log(`Published ${p.proposal_id} v${p.version}; original SHA-256 ${digest}`);
