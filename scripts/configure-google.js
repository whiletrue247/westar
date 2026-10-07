// Read an owner-created Web OAuth client JSON. Never print or commit credential values.
import {readFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const path=process.argv[2];if(!path)throw new Error('Usage: node scripts/configure-google.js /absolute/path/to/web-client.json');
const json=JSON.parse(await readFile(path,'utf8')),web=json.web;const redirect='https://westar-proposal-api.tomben49999999.workers.dev/auth/google/callback';
if(!web?.client_id?.endsWith('.apps.googleusercontent.com')||!web.client_secret||!web.redirect_uris?.includes(redirect))throw new Error('Expected a Google Web OAuth client with the exact WESTAR redirect URI.');
const wrangler=fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url));
for(const [name,value] of [['GOOGLE_CLIENT_ID',web.client_id],['GOOGLE_CLIENT_SECRET',web.client_secret]]){const r=spawnSync(process.execPath,[wrangler,'secret','put',name],{input:value,encoding:'utf8',cwd:fileURLToPath(new URL('..',import.meta.url))});if(r.status!==0)throw new Error(`Could not upload ${name}; inspect Wrangler configuration without exposing the secret.`);console.log(`${name} saved as a backend secret.`);}
