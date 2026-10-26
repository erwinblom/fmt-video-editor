import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {writeJSON} from './interviews.mjs';
import {reviewSnapshot,montageReview} from './public/export-status.mjs';

// Human confirmations are separate from the montage and from machine findings.
export function reviewService(projectRoot,catalog,source){
 const data=path.join(projectRoot,'data'),file=path.join(data,'review-baseline.json');
 const state=()=>JSON.parse(fs.readFileSync(path.join(data,'montages.json'),'utf8'));
 const sourceStamp=()=>{const stat=fs.statSync(source);return {path:source,bytes:stat.size,modified:stat.mtimeMs};};
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const token=stamp=>createHash('sha256').update(JSON.stringify(stamp)).digest('hex');
 const receipt=()=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
 const audit=()=>{const p=path.join(data,'audio-audit.json');return fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):{status:'none',issues:[]};};
 function decorate(job){
  const stamp=sourceStamp(),base={...job,reviewSourceToken:token(stamp)};
  let baseline;try{baseline=receipt();}catch{return {...base,reviewSourceChanged:true};}
  if(!baseline||baseline.version!==1)return base;
  const result={...base,montageReview:baseline,reviewSourceChanged:!same(baseline.source,stamp)},s=state(),review=montageReview(s,catalog,result);
  // A human review can satisfy audio readiness without launching a new paid audit.
  if(job.status!=='running'&&review.audioComplete){
   result.status='ready';result.mode=s.mode;result.revision=s.revision;
   result.issues=(job.issues||[]).filter(i=>review.items.some(x=>x.key===i.key)).map(i=>review.items.find(x=>x.key===i.key)?.audio?{...i,resolved:true}:i);
   if(job.status!=='ready')result.message='Audio gecontroleerd voor de huidige fragmenten.';
  }
  return result;
 }
 function confirm(input){
  if(!['audio','visual'].includes(input.kind))throw Error('Kies een knip of beeldovergang om te controleren.');
  const s=state();if(!Number.isInteger(input.revision)||s.revision!==input.revision||s.mode!==input.mode)throw Error('De montage is gewijzigd. Herlaad de controle en probeer opnieuw.');
  const current=reviewSnapshot(s,catalog).items.find(x=>x.id===input.id&&x.blockId===input.blockId);
  if(!current)throw Error('Dit fragment staat niet meer op deze plek in de montage.');
  const stamp=sourceStamp();if(input.sourceToken!==token(stamp))throw Error('De bron is gewijzigd. Herlaad en controleer opnieuw.');
  if(input.signature!==JSON.stringify(current[input.kind]))throw Error('De knip of overgang is inmiddels gewijzigd. Controleer de huidige versie.');
  const job=audit();if(job.status==='running')throw Error('Wacht tot de lopende audiocontrole is afgerond.');
  const previous=receipt(),next=previous?.version===1&&same(previous.source,stamp)?structuredClone(previous):{version:1,source:stamp,modes:{}};
  next.modes??={};next.modes[s.mode]??={mode:s.mode,items:[]};const items=next.modes[s.mode].items;
  let item=items.find(x=>x.key===current.key);if(!item){item={key:current.key,id:current.id,blockId:current.blockId,title:current.title};items.push(item);}
  item[input.kind]=current[input.kind];item[input.kind+'Review']={method:'human',at:new Date().toISOString(),auditId:job.id||null};
  if(previous){const backup=path.join(data,'herstel',`${Date.now()}-review.json`);fs.mkdirSync(path.dirname(backup),{recursive:true});fs.copyFileSync(file,backup);}
  writeJSON(file,next);return decorate(job);
 }
 return {decorate,confirm};
}
