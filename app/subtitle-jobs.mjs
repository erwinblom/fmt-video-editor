import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {writeJSON} from './interviews.mjs';
import {subtitleSnapshot} from './subtitle-core.mjs';
export function subtitleJobs(appRoot,projectRoot,catalog){
 const data=path.join(projectRoot,'data'),file=path.join(data,'subtitle-status.json');
 function read(){
  if(!fs.existsSync(file))return {status:'none'};const s=JSON.parse(fs.readFileSync(file,'utf8'));
  if(s.status==='running'){let alive=false;if(s.pid)try{process.kill(s.pid,0);alive=true;}catch{}if(!alive){s.status='failed';s.pid=null;s.message='Ondertitelredactie onderbroken. Je bron en montage zijn behouden. Probeer opnieuw.';writeJSON(file,s);}}
  if(s.status==='complete'){const result=path.join(data,'subtitle-jobs',s.id,'result.json');if(!fs.existsSync(result))return {...s,status:'failed',message:'Ondertitelresultaat ontbreekt. Probeer opnieuw.'};s.result=JSON.parse(fs.readFileSync(result,'utf8'));}return s;
 }
 function start(input={}){
  const state=JSON.parse(fs.readFileSync(path.join(data,'montages.json'),'utf8')),snapshot=subtitleSnapshot(state,catalog,input),old=read();
  if(old.status==='running')throw Error('Ondertitelredactie loopt al. Wacht tot die klaar is.');
  const id=randomUUID(),dir=path.join(data,'subtitle-jobs',id);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'snapshot.json'),JSON.stringify(snapshot,null,2),{flag:'wx'});
  const job={id,status:'running',message:'Ondertitels voorbereiden met Terra',revision:input.revision,mode:input.mode,subtitleLanguage:input.subtitleLanguage,createdAt:Date.now(),completed:0,total:snapshot.items.length};
  // Write before spawning; the worker owns subsequent status updates.
  writeJSON(file,job);const log=fs.openSync(path.join(dir,'worker.log'),'a');const child=spawn(process.execPath,[path.join(appRoot,'generate-subtitles.mjs'),projectRoot,id],{detached:true,stdio:['ignore',log,log]});fs.closeSync(log);job.pid=child.pid;writeJSON(file,job);
  child.on('error',()=>{const current=JSON.parse(fs.readFileSync(file,'utf8'));if(current.id===id)writeJSON(file,{...job,status:'failed',pid:null,message:'Ondertitelredactie kon niet starten. Je montage is behouden.'});});child.unref();return job;
 }
 return {read,start};
}
