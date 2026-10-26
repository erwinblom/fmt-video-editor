import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeJSON} from './interviews.mjs';
import {withSubtitleModel,SUBTITLE_MODEL_ID} from './cloud-subtitle-model.mjs';
import {generateSubtitles} from './subtitle-core.mjs';
export async function runSubtitles(projectRoot,id,model=withSubtitleModel){
 if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Ongeldige ondertitelopdracht.');
 const data=path.join(projectRoot,'data'),dir=path.join(data,'subtitle-jobs',id),file=path.join(data,'subtitle-status.json'),snapshot=JSON.parse(fs.readFileSync(path.join(dir,'snapshot.json'),'utf8'));let job=JSON.parse(fs.readFileSync(file,'utf8'));
 if(job.id!==id)throw Error('Ondertitelopdracht is vervangen.');
 const update=(message,extra={})=>{if(JSON.parse(fs.readFileSync(file,'utf8')).id!==id)throw Error('Ondertitelopdracht is vervangen.');job={...job,message,...extra};writeJSON(file,job);};
 try{
  const began=performance.now();update('Ondertitels voorbereiden met Terra',{pid:process.pid,status:'running',model:SUBTITLE_MODEL_ID});const cacheFile=path.join(data,'subtitle-cache.json');let saved={};try{saved=JSON.parse(fs.readFileSync(cacheFile,'utf8'));}catch{}
  const result=await model(dir,ask=>generateSubtitles({...snapshot,modelId:SUBTITLE_MODEL_ID},ask,update,{get:key=>saved[key],set:(key,value)=>{saved[key]=value;writeJSON(cacheFile,saved);}}));
  result.model=SUBTITLE_MODEL_ID;result.elapsedSeconds=Math.round((performance.now()-began)/100)/10;
  fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(result,null,2),{flag:'wx'});update('Ondertitelvoorstel gereed; controleer en pas toe.',{status:'complete',pid:null,model:SUBTITLE_MODEL_ID,elapsedSeconds:result.elapsedSeconds,completed:snapshot.items.length,finishedAt:Date.now()});return result;
 }catch(e){update(e.message,{status:'failed',pid:null,finishedAt:Date.now()});throw e;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)runSubtitles(process.argv[2],process.argv[3]).catch(e=>{console.error(e);process.exitCode=1;});
