import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {writeJSON} from './interviews.mjs';
export function analysisJobs(appRoot,projectRoot){
 const dir=path.join(projectRoot,'data'),file=path.join(dir,'analysis-status.json');
 function read(){if(!fs.existsSync(file))return {status:'none'};const s=JSON.parse(fs.readFileSync(file,'utf8'));if(s.status==='running'&&s.pid){try{process.kill(s.pid,0);}catch{s.status='failed';s.message='Analyse onderbroken. Je bron en montage zijn behouden. Probeer opnieuw.';writeJSON(file,s);}}return s;}
 function start(input={}){const old=read();if(old.status==='running')return old;if(typeof input.angle!=='string'||input.angle.length>1000)throw Error('Ongeldige redactie-aanwijzing');fs.mkdirSync(dir,{recursive:true});const job={id:randomUUID(),status:'running',message:'Terra: redactionele analyse starten',angle:input.angle,createdAt:Date.now()};writeJSON(file,job);const log=fs.openSync(path.join(projectRoot,'analyse.log'),'a');const child=spawn(process.execPath,[path.join(appRoot,'analyze-interview.mjs'),projectRoot],{detached:true,stdio:['ignore',log,log]});fs.closeSync(log);job.pid=child.pid;writeJSON(file,job);child.on('error',()=>writeJSON(file,{...job,status:'failed',message:'De analyse kon niet starten. Je bron en montage zijn behouden.'}));child.unref();return job;}
 return {read,start};
}
