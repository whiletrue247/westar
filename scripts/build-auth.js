import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
const result=await build({entryPoints:['backend/popup.js'],bundle:true,write:false,format:'iife',platform:'browser',minify:true});await mkdir('backend/generated',{recursive:true});await writeFile('backend/generated/popup.js','export default '+JSON.stringify(result.outputFiles[0].text)+';\n');
