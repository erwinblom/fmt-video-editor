import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const configFile=path.join(projectRoot,'.fmt-local.json');
let local={};
if(fs.existsSync(configFile)){
 try{local=JSON.parse(fs.readFileSync(configFile,'utf8'));}catch{throw Error('Controleer .fmt-local.json: dit is geen geldig JSON-bestand.');}
 for(const [key,value] of Object.entries(local)){
  if(!/^FMT_[A-Z0-9_]+$/.test(key)||typeof value!=='string')throw Error('Gebruik in .fmt-local.json alleen FMT-instellingen met tekstwaarden.');
  process.env[key]??=value;
 }
}
process.env.FMT_EDITOR_PORT??='4319';
export function command(name){return process.env['FMT_'+name.toUpperCase().replaceAll('-','_')+'_BIN']||name;}
const pythonCandidates=[process.env.FMT_PYTHON,path.join(projectRoot,'.venv/bin/python3')];
export const python=pythonCandidates.find(p=>p&&fs.existsSync(p))||'python3';
export const templateDir=process.env.FMT_TEMPLATE_DIR||path.join(projectRoot,'template');
export const originalSource=process.env.FMT_LEGACY_SOURCE||path.join(projectRoot,'app/data/demo/source.mp4');
