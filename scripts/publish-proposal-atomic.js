// Publish one marked assistant Proposal as one Git commit, push it, then verify remote read-back.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve} from 'node:path';

const [inputPath,repoPath]=process.argv.slice(2);
if(!inputPath||!repoPath){console.error('Usage: node scripts/publish-proposal-atomic.js <marked-deliverable.json> <private-repo-directory>');process.exit(1);}
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(repoPath);
const run=(cmd,args,opts={})=>{const r=spawnSync(cmd,args,{encoding:'utf8',...opts});if(r.status!==0)throw new Error((r.stderr||r.stdout||cmd+' failed').trim());return (r.stdout||'').trim();};
const git=(...args)=>run('git',['-C',repo,...args]);
const input=JSON.parse(await readFile(inputPath,'utf8'));
if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(input.proposal_id||''))throw new Error('Invalid proposal_id');
const proposalPath='proposals/'+input.proposal_id+'.json';

git('fetch','origin','main');
const head=git('rev-parse','HEAD'),remote=git('rev-parse','origin/main');
if(head!==remote)throw new Error('Private checkout must be exactly synchronized with origin/main before publishing');
if(git('branch','--show-current')!=='main')throw new Error('Atomic publisher requires the main branch');
if(git('status','--porcelain=v1'))throw new Error('Atomic publisher requires a clean private checkout');

let committed=false;
try{
  run(process.execPath,[join(here,'publish-proposal.js'),inputPath,repo]);
  run(process.execPath,[join(here,'validate-intel.js'),repo]);
  const changed=git('status','--porcelain=v1').split('\n').filter(Boolean).map(line=>line.slice(3));
  const allowed=new Set([proposalPath,'index.json']);
  if(!changed.length||changed.some(path=>!allowed.has(path)))throw new Error('Publisher changed unexpected files: '+changed.join(', '));
  git('add','--',proposalPath,'index.json');
  const staged=git('diff','--cached','--name-only').split('\n').filter(Boolean);
  if(!staged.includes(proposalPath)||staged.some(path=>!allowed.has(path)))throw new Error('Atomic commit does not contain the expected Proposal files');
  git('commit','-m',`Publish ${input.proposal_id} proposal atomically`);
  committed=true;
  const commit=git('rev-parse','HEAD');
  git('push','origin','HEAD:main');
  git('fetch','origin','main');
  if(git('rev-parse','origin/main')!==commit)throw new Error('Remote main did not advance to the published commit');
  const proposal=JSON.parse(git('show',`origin/main:${proposalPath}`));
  const index=JSON.parse(git('show','origin/main:index.json'));
  const digest=createHash('sha256').update(proposal.content,'utf8').digest('hex');
  if(digest!==proposal.source?.sha256||digest!==input.source?.sha256)throw new Error('Remote Proposal content hash mismatch');
  if(!index.proposal_ids?.includes(input.proposal_id))throw new Error('Remote index does not contain the Proposal');
  console.log(JSON.stringify({proposal_id:input.proposal_id,version:proposal.version,commit,content_sha256:digest,remote_verified:true}));
}catch(error){
  if(!committed){try{git('reset','--hard',head);}catch{}}
  throw error;
}
