import {importEngine} from './basic-import.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
import {originalSource as original,command} from './runtime-config.mjs';
const builtIn={id:'demo',title:'Demo Werkplaats · Gast',status:'ready',guest:'Gast',interviewer:'',organization:'Demo Werkplaats',topic:'',intro:'Gast over de fictieve gereedschapsbibliotheek Demo Werkplaats.',createdAt:0};
const metadataFields=['title','guest','interviewer','organization','topic','intro'];
const builtInFiles=['thumbnails','cut-proposals','card-reels','transition-previews','element-proposals','element-work','element-review-queue','element-assets','catalog.json','montages.json','proposal-bank.json','interview-metadata.json','subtitle-cache.json','subtitle-status.json','analysis-status.json','speakers.json','subtitle-jobs','audio-audit.json','review-baseline.json','audio-audits','audio-audit-cache','herstel','exports'];
export function writeJSON(file,data){fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2));fs.renameSync(file+'.tmp',file);}
export function interviewStore(root){
 const data=path.join(root,'data'),home=path.join(data,'interviews'),trash=path.join(home,'.trash');fs.mkdirSync(home,{recursive:true});
 const dir=id=>{if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Onbekend interview');return path.join(home,id);};
 function archiveFor(id){if(!fs.existsSync(trash))return null;for(const name of fs.readdirSync(trash)){try{const p=path.join(trash,name),manifest=JSON.parse(fs.readFileSync(path.join(p,'manifest.json'),'utf8'));if(manifest.id===id)return {path:p,manifest};}catch{}}return null;}
 function read(id){if(id==='demo'){if(archiveFor(id))throw Error('Dit interview staat in de prullenbak. Herstel het via Beheer.');const file=path.join(data,'interview-metadata.json');return {...builtIn,...(fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{})};}const p=dir(id),m=JSON.parse(fs.readFileSync(path.join(p,'interview.json'),'utf8'));if((m.status==='processing'||m.backgroundProcessing)&&m.pid){try{process.kill(m.pid,0);}catch{const transcriptReady=fs.existsSync(path.join(p,'data/catalog.json'));m.status=transcriptReady?'ready':'failed';m.backgroundProcessing=false;m.pid=null;m.message=transcriptReady?'Achtergrondverwerking onderbroken. Je kunt blijven monteren en de analyse opnieuw starten.':'Transcriptie onderbroken. Je opname is bewaard. Probeer opnieuw.';writeJSON(path.join(p,'interview.json'),m);}}return m;}
 function context(id='demo'){if(id==='demo')return {id,root,stateFile:path.join(data,'montages.json'),catalogFile:path.join(data,'catalog.json'),bankFile:path.join(data,'proposal-bank.json'),source:original,exportSource:original,metadata:{...read(id),hasVideo:true}};const p=dir(id),m=read(id);if(m.status!=='ready')throw Error('Dit interview wordt nog voorbereid.');return {id,root:p,stateFile:path.join(p,'data/montages.json'),catalogFile:path.join(p,'data/catalog.json'),bankFile:path.join(p,'data/proposal-bank.json'),source:path.join(p,m.previewFile||m.sourceFile),exportSource:path.join(p,m.sourceFile),metadata:m};}
 function start(id,input={}){const p=dir(id),m=read(id);if(m.status==='ready'||m.status==='processing')return m;if(fs.existsSync(path.join(p,'data/catalog.json')))throw Error('Dit interview heeft al een transcript. Herstel eerst de projectstatus; opnieuw transcriberen zou je bewerking vervangen.');if(input.transcriptionEngine!==undefined){m.transcriptionEngine=importEngine(input.transcriptionEngine);writeJSON(path.join(p,'interview.json'),m);}if(input.language!==undefined){if(!['auto','nl','en','de','fr'].includes(input.language))throw Error('Ongeldige brontaal');m.language=input.language;m.sourceLanguage=input.language;writeJSON(path.join(p,'interview.json'),m);}const log=fs.openSync(path.join(p,'transcriptie.log'),'a');const child=spawn(process.execPath,[path.join(root,'transcribe-interview.mjs'),p],{detached:true,stdio:['ignore',log,log]});fs.closeSync(log);const next={...m,status:'processing',message:'Transcriptie voorbereiden',pid:child.pid};writeJSON(path.join(p,'interview.json'),next);child.on('error',()=>{writeJSON(path.join(p,'interview.json'),{...next,status:'failed',message:'Transcriptie kon niet starten. Je opname is bewaard.'});});child.unref();return next;}
 async function upload(req,url){
  const importStartedAt=Date.now(),transcriptionEngine=importEngine(url.searchParams.get('transcriptionEngine')||'manual');
  const title=(url.searchParams.get('title')||'').trim(),name=path.basename(url.searchParams.get('name')||''),language=url.searchParams.get('language')||'auto';
  if(!title||title.length>120)throw Error('Geef je interview een naam van maximaal 120 tekens.');
  if(!['auto','nl','en','de','fr'].includes(language))throw Error('Ongeldige taal');
  const subtitleLanguage=url.searchParams.get('subtitleLanguage')||'nl';if(!['nl','en'].includes(subtitleLanguage))throw Error('Kies Nederlands of Engels als ondertiteltaal.');
  const details=Object.fromEntries(['guest','interviewer','topic'].map(key=>[key,(url.searchParams.get(key)||'').trim()]));if(Object.values(details).some(v=>v.length>500))throw Error('Gebruik maximaal 500 tekens per informatieveld.');
  const speakerCount=Number(url.searchParams.get('speakerCount')??2);if(!Number.isInteger(speakerCount)||speakerCount<0||speakerCount>12||speakerCount===1)throw Error('Kies automatisch of 2 tot 12 stemmen.');
  const target=Number(url.searchParams.get('target')||300),direction=(url.searchParams.get('direction')||'').trim();if(!Number.isFinite(target)||target<30||target>7200||direction.length>1000)throw Error('Kies een tijdlimiet tussen een halve minuut en twee uur.');
  const ext=path.extname(name).toLowerCase();if(!['.mp4','.mov','.m4v','.webm','.mkv','.mp3','.wav','.m4a','.aac','.ogg','.flac'].includes(ext))throw Error('Kies een gangbaar video- of audiobestand.');
  const max=8*1024**3;if(Number(req.headers['content-length'])>max)throw Error('Het bestand is groter dan 8 GB.');
  const id=randomUUID(),p=dir(id);fs.mkdirSync(p);let bytes=0;const hash=createHash('sha256'),tmp=path.join(p,'upload.part');
  try{await pipeline(req,new Transform({transform(chunk,enc,cb){bytes+=chunk.length;if(bytes>max)return cb(Error('Het bestand is groter dan 8 GB.'));hash.update(chunk);cb(null,chunk);}}),fs.createWriteStream(tmp,{flags:'wx'}));
   const copiedAt=Date.now();const probe=spawnSync(command('ffprobe'),['-v','error','-show_format','-show_streams','-of','json',tmp],{encoding:'utf8',timeout:30000,maxBuffer:2*1024**2});if(probe.status!==0)throw Error('Dit bestand is niet als video of audio te lezen.');
   const media=JSON.parse(probe.stdout),audio=media.streams.find(s=>s.codec_type==='audio'),video=media.streams.find(s=>s.codec_type==='video'&&!s.disposition?.attached_pic),duration=Number(media.format.duration);if(!audio)throw Error('Er staat geen audiotrack in dit bestand.');if(!Number.isFinite(duration)||duration<.1||duration>7200)throw Error('Kies een opname van maximaal twee uur.');
   const sourceFile='bron'+ext;fs.renameSync(tmp,path.join(p,sourceFile));const m={id,title,transcriptionEngine,...details,target,direction,speakerCount,originalName:name,sourceFile,bytes,sha256:hash.digest('hex'),duration,hasVideo:!!video,width:video?.width||1920,height:video?.height||1080,language,sourceLanguage:language,subtitleLanguage,status:'uploaded',importStartedAt,timings:{copyMs:copiedAt-importStartedAt,probeMs:Date.now()-copiedAt},createdAt:Date.now(),message:'Opname lokaal bewaard'};writeJSON(path.join(p,'interview.json'),m);return start(id);
  }catch(e){fs.rmSync(p,{recursive:true,force:true});throw e;}
 }
 function ensureIdle(id,projectRoot){
  const m=read(id);if(m.status==='processing'||m.backgroundProcessing){if(!m.pid)throw Error('Dit interview wordt nog verwerkt. Probeer het daarna opnieuw.');try{process.kill(m.pid,0);throw Error('Dit interview wordt nog verwerkt. Probeer het daarna opnieuw.');}catch(e){if(e.message.includes('wordt nog verwerkt'))throw e;}}
  const exports=path.join(projectRoot,'data/exports');if(fs.existsSync(exports))for(const job of fs.readdirSync(exports)){try{const s=JSON.parse(fs.readFileSync(path.join(exports,job,'status.json'),'utf8'));if(s.status==='running'&&s.pid){try{process.kill(s.pid,0);throw Error('Voor dit interview wordt nog een video gemaakt. Wacht tot die klaar is.');}catch(e){if(e.message.includes('wordt nog'))throw e;}}}catch(e){if(e.message.includes('wordt nog'))throw e;}}
  return m;
 }
 function updateMetadata(id,input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Ongeldige interviewgegevens.');
  const current=read(id),next={...current};for(const key of metadataFields){if(input[key]===undefined)continue;if(typeof input[key]!=='string')throw Error('Vul interviewgegevens als tekst in.');const limit=key==='title'?120:1000;if(input[key].length>limit)throw Error(`Gebruik maximaal ${limit} tekens bij ${key}.`);next[key]=input[key].trim();}
  if(!next.title)throw Error('Geef het interview een naam.');
  if(id==='demo')writeJSON(path.join(data,'interview-metadata.json'),next);else writeJSON(path.join(dir(id),'interview.json'),next);
  const catalogFile=id==='demo'?path.join(data,'catalog.json'):path.join(dir(id),'data/catalog.json');if(fs.existsSync(catalogFile)){const catalog=JSON.parse(fs.readFileSync(catalogFile,'utf8'));catalog.title=next.title;catalog.details={...catalog.details,guest:next.guest||'',interviewer:next.interviewer||'',topic:next.topic||''};writeJSON(catalogFile,catalog);}
  return next;
 }
 function archive(id){
  const projectRoot=id==='demo'?data:dir(id),m=ensureIdle(id,projectRoot);if(archiveFor(id))throw Error('Dit interview staat al in de prullenbak.');if(listInterviews().length<=1)throw Error('Laat minimaal één interview actief. Maak eerst een ander interview of herstel er een uit de prullenbak.');
  const stamp=Date.now(),archiveId=`${stamp}-${id}`,target=path.join(trash,archiveId),project=path.join(target,'project');fs.mkdirSync(project,{recursive:true});
  const moved=[];try{
   if(id==='demo'){for(const name of builtInFiles){const from=path.join(data,name);if(fs.existsSync(from)){const to=path.join(project,name);fs.renameSync(from,to);moved.push(name);}}}
   else{fs.renameSync(projectRoot,project);moved.push('project');}
   writeJSON(path.join(target,'manifest.json'),{archiveId,id,archivedAt:stamp,builtIn:id==='demo',moved,metadata:m});
  }catch(e){for(const name of moved.reverse()){const from=id==='demo'?path.join(project,name):project;const to=id==='demo'?path.join(data,name):projectRoot;if(fs.existsSync(from))fs.renameSync(from,to);}fs.rmSync(target,{recursive:true,force:true});throw e;}
  return {archiveId,id,archivedAt:stamp,builtIn:id==='demo',title:m.title,metadata:m};
 }
 function listTrash(){if(!fs.existsSync(trash))return [];return fs.readdirSync(trash).flatMap(archiveId=>{try{if(!/^\d+-(?:demo|[a-f0-9-]{36})$/.test(archiveId))return [];const p=path.join(trash,archiveId),manifest=JSON.parse(fs.readFileSync(path.join(p,'manifest.json'),'utf8'));return [{archiveId:manifest.archiveId,id:manifest.id,archivedAt:manifest.archivedAt,builtIn:!!manifest.builtIn,title:manifest.metadata?.title||manifest.id,metadata:manifest.metadata}];}catch{return [];}}).sort((a,b)=>b.archivedAt-a.archivedAt);}
 function restore(archiveId){
  if(typeof archiveId!=='string'||!/^\d+-(?:demo|[a-f0-9-]{36})$/.test(archiveId))throw Error('Onbekend interview in de prullenbak.');
  const target=path.join(trash,archiveId),manifest=JSON.parse(fs.readFileSync(path.join(target,'manifest.json'),'utf8'));if(manifest.archiveId!==archiveId)throw Error('Ongeldig herstelbestand.');
  if(manifest.builtIn){const collisions=manifest.moved.filter(name=>fs.existsSync(path.join(data,name)));if(collisions.length)throw Error('Herstellen kan niet: interviewgegevens bestaan al.');const moved=[];try{for(const name of manifest.moved){fs.renameSync(path.join(target,'project',name),path.join(data,name));moved.push(name);}}catch(e){for(const name of moved.reverse())fs.renameSync(path.join(data,name),path.join(target,'project',name));throw e;}}
  else{const destination=dir(manifest.id);if(fs.existsSync(destination))throw Error('Er bestaat al een actief interview met deze code.');fs.renameSync(path.join(target,'project'),destination);}
  fs.rmSync(target,{recursive:true,force:true});return read(manifest.id);
 }
 function purge(archiveId){
  if(typeof archiveId!=='string'||!/^\d+-(?:demo|[a-f0-9-]{36})$/.test(archiveId))throw Error('Onbekend interview in de prullenbak.');const target=path.join(trash,archiveId),manifest=JSON.parse(fs.readFileSync(path.join(target,'manifest.json'),'utf8'));if(manifest.archiveId!==archiveId)throw Error('Ongeldig verwijderbestand.');fs.rmSync(target,{recursive:true,force:true});return {deleted:true,builtIn:!!manifest.builtIn};
 }
 function listInterviews(){const items=[];if(fs.existsSync(path.join(data,'catalog.json'))&&!archiveFor('demo'))try{items.push(read('demo'));}catch{}return [...items,...fs.readdirSync(home).filter(x=>/^[a-f0-9-]{36}$/.test(x)).flatMap(id=>{try{return [read(id)];}catch{return [];}}).sort((a,b)=>b.createdAt-a.createdAt)];}
 return {read,context,start,upload,media:id=>{const m=read(id);return path.join(dir(id),m.previewFile||m.sourceFile);},updateMetadata,archive,listTrash,restore,purge,list:listInterviews};
}
