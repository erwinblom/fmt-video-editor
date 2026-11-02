import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
function run(bin,args){const r=spawnSync(bin,args,{stdio:'inherit',shell:process.platform==='win32'&&/\.cmd$/.test(bin)});if(r.status!==0)throw Error(`Installatie mislukt: ${bin}. Controleer de melding hierboven.`);}
if(Number(process.versions.node.split('.')[0])<22||(process.versions.node.split('.')[0]==='22'&&Number(process.versions.node.split('.')[1])<16))throw Error('Installeer Node.js 22.16 of nieuwer.');
const py=process.platform==='win32'?'python':'python3';
run(py,['-c','import sys; assert sys.version_info >= (3,11), "Python 3.11 of nieuwer nodig"']);
run(process.platform==='win32'?'npm.cmd':'npm',['ci']);
const python=path.join(root,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python3');
if(!fs.existsSync(python))run(py,['-m','venv',path.join(root,'.venv')]);
run(python,['-m','pip','install','-r','scripts/python-requirements.txt']);
fs.mkdirSync('app/data',{recursive:true});
for(const [from,to] of [['.fmt-local.example.json','.fmt-local.json'],['.env.example','.env.local']])if(!fs.existsSync(to))fs.copyFileSync(from,to);
run(process.execPath,['scripts/check-installation.mjs']);
console.log('Installatie klaar. Start met node scripts/start.mjs. Sluit het terminalvenster om te stoppen.');
