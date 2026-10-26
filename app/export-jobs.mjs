import {readStyle} from './own-style.mjs';
import {elementAssets} from './element-assets.mjs';
import {python,templateDir} from './runtime-config.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {montageSignature} from './public/export-status.mjs';
import {exportPlan} from './export-plan.mjs';
const defaultAppRoot=path.dirname(fileURLToPath(import.meta.url));
const isId=id=>/^[a-f0-9-]{36}$/.test(id);
function readJob(p){
 const s=JSON.parse(fs.readFileSync(path.join(p,'status.json'),'utf8'));
 if(s.status==='running'&&s.pid){try{process.kill(s.pid,0);}catch{s.status='failed';s.message='Export onderbroken. Start een nieuwe export.';}}
 s.signature??=null;return s;
}
export function activeExport(appRoot){
 const homes=[appRoot],imports=path.join(appRoot,'data/interviews');
 if(fs.existsSync(imports))for(const id of fs.readdirSync(imports).filter(isId))homes.push(path.join(imports,id));
 for(const home of homes){
  const dir=path.join(home,'data/exports');if(!fs.existsSync(dir))continue;
  for(const id of fs.readdirSync(dir).filter(isId)){try{const job=readJob(path.join(dir,id));if(job.status==='running')return job;}catch{}}
 }
 return null;
}
export function exportContext(source,metadata={},catalog={},projectId){
 if(!source||!fs.statSync(source).isFile())throw Error('Het oorspronkelijke opnamebestand ontbreekt.');
 const stat=fs.statSync(source),title=metadata.title||catalog.title||'Interview';
 return {projectId,source:path.resolve(source),sourceBytes:stat.size,sourceModifiedMs:stat.mtimeMs,sourceSha256:metadata.sha256||null,
  hasVideo:metadata.hasVideo??catalog.hasVideo??true,
  guest:metadata.guest?.trim()||catalog.details?.guest?.trim()||title,
  organization:metadata.organization||'',title,intro:metadata.intro||title};
}
export function exportJobs(root,catalog,{appRoot=defaultAppRoot,source,metadata={},projectId}={}){
 const dir=path.join(root,'data/exports');fs.mkdirSync(dir,{recursive:true});
 const safe=id=>{if(!isId(id))throw Error('Onbekende export');return path.join(dir,id);};
 const read=id=>{const job=readJob(safe(id));const key=createHash('sha256').update(JSON.stringify(readStyle(appRoot))).digest('hex');if(job.styleHash!==key)job.signature=null;return job;};
 const list=()=>fs.readdirSync(dir).filter(isId).flatMap(id=>{try{return [read(id)];}catch{return [];}}).sort((a,b)=>b.createdAt-a.createdAt);
 return {read,list,file:(id,name)=>path.join(safe(id),name),start(state,{reviewMethod='unspecified'}={}){
  const plan=exportPlan(state,catalog),context={...exportContext(source,metadata,catalog,projectId),style:readStyle(appRoot),reviewMethod};
  const hash=createHash('sha256').update(JSON.stringify({plan,context,pipeline:11})).digest('hex');
  const same=list().find(j=>j.hash===hash&&['complete','running'].includes(j.status));if(same)return same;
  if(activeExport(appRoot))throw Error('Er wordt al een video gemaakt. Wacht tot die export klaar is.');
  const id=randomUUID(),p=safe(id);fs.mkdirSync(p);
  for(const [name,data] of Object.entries({state,catalog,plan,'export-context':context}))fs.writeFileSync(path.join(p,name+'.json'),JSON.stringify(data,null,2));
  const assets=elementAssets(root);const images=new Set(plan.events.flatMap(e=>e.element?[e.element.artworkId,e.element.assetId].filter(Boolean):[]));if(images.size){fs.mkdirSync(path.join(p,'elements'));for(const image of images)assets.snapshot(image,path.join(p,'elements',image+'.png'));}
  const status={id,hash,styleHash:createHash('sha256').update(JSON.stringify(context.style)).digest('hex'),projectId,title:context.title,videoFile:'interview.mp4',subtitleFile:`ondertitels-${plan.subtitleLanguage}.srt`,signature:montageSignature(state,catalog),status:'running',message:'Export voorbereiden',progress:0,createdAt:Date.now()/1000,mode:state.mode,revision:state.revision??0,subtitleLanguage:plan.subtitleLanguage,duration:plan.duration};
  fs.writeFileSync(path.join(p,'status.json'),JSON.stringify(status));
  const log=fs.openSync(path.join(p,'runner.log'),'a');
  const child=spawn(python,[path.join(appRoot,'build-export.py'),p],{cwd:appRoot,stdio:['ignore',log,log],detached:true,env:process.env});child.unref();fs.closeSync(log);status.pid=child.pid;fs.writeFileSync(path.join(p,'status.json'),JSON.stringify(status));
  child.on('error',e=>{status.status='failed';status.message='Export kon niet starten: '+e.message;fs.writeFileSync(path.join(p,'status.json'),JSON.stringify(status));});return status;
 }};
}
