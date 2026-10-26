import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {python,templateDir} from './runtime-config.mjs';
const pending=new Map();
function digestTree(folder,hash){for(const name of fs.readdirSync(folder).sort()){const p=path.join(folder,name);hash.update(name);if(fs.statSync(p).isDirectory())digestTree(p,hash);else hash.update(fs.readFileSync(p));}}
let templateHash;
export async function cardReel(appRoot,root,config){
 if(!templateHash){const hash=createHash('sha256');hash.update(fs.readFileSync(path.join(appRoot,'make-cards.py')));digestTree(templateDir,hash);templateHash=hash.digest('hex');}
 const key=createHash('sha256').update(JSON.stringify({version:1,templateHash,config})).digest('hex');
 const dir=path.join(root,'data/card-reels',key),output=path.join(dir,'cards.mp4');
 if(fs.existsSync(output))return output;
 if(!pending.has(dir))pending.set(dir,(async()=>{
  fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'request.json'),JSON.stringify({config,root}));
  await new Promise((resolve,reject)=>{const child=spawn(python,[path.join(appRoot,'ensure-card-reel.py'),dir],{stdio:['ignore','ignore','pipe']});let error='';child.stderr.on('data',b=>error=(error+b).slice(-1000));child.on('error',reject);child.on('close',code=>code?reject(Error('Hoofdstukkaart kon niet worden voorbereid: '+error.slice(-250))):resolve());});
 })().finally(()=>pending.delete(dir)));
 await pending.get(dir);return output;
}
