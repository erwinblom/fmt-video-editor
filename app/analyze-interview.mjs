import {withEditorialRules,editorialCache,editorialRules} from './editorial-rules.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeJSON} from './interviews.mjs';
import {semanticPassages} from './semantic-passages.mjs';
import {withEditorialModel,EDITORIAL_MODEL_ID,EDITORIAL_MODEL_LABEL} from './editorial-model.mjs';
import {analyzeTranscript,rankDirection} from './thematic-analysis.mjs';
export async function runAnalysis(dir,notify=()=>{},angle='',dependencies={}){
 const data=path.join(dir,'data'),file=path.join(data,'analysis-status.json');
 let job=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{id:'initial',angle:''};job={...job,status:'running',angle,pid:process.pid};
 function update(message,extra={}){job={...job,message,...extra};writeJSON(file,job);notify(message);}
 try{update('Terra: redactionele analyse starten');const catalog=JSON.parse(fs.readFileSync(path.join(data,'catalog.json'),'utf8'));let bank;
  await (dependencies.withModel||withEditorialModel)(dir,async rawAsk=>{
   const ask=withEditorialRules(rawAsk);
   if(!angle||!fs.existsSync(path.join(data,'proposal-bank.json'))){const cacheFile=path.join(data,'analysis-cache-'+EDITORIAL_MODEL_ID+'.json');let chunks={};try{chunks=JSON.parse(fs.readFileSync(cacheFile,'utf8'));}catch{}const cache=editorialCache({get:key=>chunks[key],set:(key,value)=>{chunks[key]=value;writeJSON(cacheFile,chunks);}});const prepared=await (dependencies.prepare||semanticPassages)(catalog,ask,update,cache);const result=await (dependencies.analyze||analyzeTranscript)(prepared,ask,update,cache);if(result.catalog.analysis)result.catalog.analysis.model=dependencies.modelLabel||EDITORIAL_MODEL_LABEL;result.bank.analysisModel=dependencies.modelLabel||EDITORIAL_MODEL_LABEL;writeJSON(path.join(data,'catalog.json'),result.catalog);writeJSON(path.join(data,'proposal-bank.json'),result.bank);bank=result.bank;}
   else bank=JSON.parse(fs.readFileSync(path.join(data,'proposal-bank.json'),'utf8'));
   if(angle){update('Redactie-aanwijzing tegen alle bronpassages beoordelen');bank=await (dependencies.rank||rankDirection)(bank,JSON.parse(fs.readFileSync(path.join(data,'catalog.json'),'utf8')),angle,ask);bank.directionModel=dependencies.modelLabel||EDITORIAL_MODEL_LABEL;}
  });
  const resultFile='analysis-result-'+job.id+'.json';bank={...bank,editorialRules:editorialRules()};writeJSON(path.join(data,resultFile),bank);update('Onderwerpen en selectievoorstel gereed',{status:'complete',pid:null,resultFile,finishedAt:Date.now()});const metaFile=path.join(dir,'interview.json');if(fs.existsSync(metaFile)){const meta=JSON.parse(fs.readFileSync(metaFile,'utf8'));if(meta.status==='ready')writeJSON(metaFile,{...meta,analysisError:null,message:'Klaar om te monteren'});}return bank;
 }catch(e){update(e.message,{status:'failed',pid:null});throw e;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const dir=process.argv[2],job=JSON.parse(fs.readFileSync(path.join(dir,'data/analysis-status.json'),'utf8'));runAnalysis(dir,()=>{},job.angle).catch(e=>{console.error(e);process.exitCode=1;});}
