import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {elementProposals} from './element-proposals.mjs';
import {makeEvidence} from './element-evidence.mjs';
import {resolveQuote,sourceText,editKey,validateEdits} from './public/model.mjs';
import {validateElement} from './public/elements.mjs';
import {elementAssets} from './element-assets.mjs';
import {writeJSON} from './interviews.mjs';
import {SUBTITLE_MODEL_ID,withSubtitleModel} from './cloud-subtitle-model.mjs';

const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const pending=new Map();
export const elementGenerationRunning=root=>[...pending.keys()].some(dir=>dir.startsWith(path.join(root,'data','element-work')+path.sep));
export function elementTiming(q,catalog,basis,type){
 const duration=q.end-q.start,words=(catalog.words||[]).filter(w=>(catalog.imported||w.speaker===q.speaker)&&w.start<q.end&&w.end>q.start);
 const joined=words.map(w=>w.text).join(''),at=joined.indexOf(basis);let offset=0,start=0;
 if(at>=0&&words.length){for(const w of words){if(offset+w.text.length>at){start=Math.max(0,w.start-q.start);break;}offset+=w.text.length;}}
 const hold=['comparison','diagram','annotatedProof','proof'].includes(type)?12:7;
 start=Math.min(start,Math.max(0,duration-.04));
 return {start:Math.round(start*25)/25,end:Math.min(duration,Math.round((start+hold)*25)/25)};
}
export function elementProposalService(root,catalog,metadata={},dependencies={}){
 const data=path.join(root,'data'),stateFile=path.join(data,'montages.json'),assets=elementAssets(root);
 const model=dependencies.model||withSubtitleModel,planner=dependencies.planner||elementProposals,evidence=dependencies.evidence||makeEvidence;
 const readState=()=>JSON.parse(fs.readFileSync(stateFile,'utf8'));
 function scope(input){
  const state=readState(),m=state.modes?.[input.mode];
  if(!['quoteverhaal','gespreksmontage'].includes(input.mode)||input.mode!==state.mode||typeof input.id!=='string'||typeof input.blockId!=='string'||!(input.blockId==='teaser'?m?.teaser:m?.blocks.find(b=>b.id===input.blockId)?.clipIds)?.includes(input.id))throw Error('Dit fragment staat niet in de actieve montage. Open het opnieuw.');
  const q=resolveQuote(state,catalog,input.id,input.blockId,input.mode),source=sourceText(catalog,q)||'';
  const key=digest({version:3,model:SUBTITLE_MODEL_ID,mode:input.mode,id:input.id,blockId:input.blockId,start:q.start,end:q.end,nl:q.nl,source,title:catalog.title,details:catalog.details,metadata:{title:metadata.title,guest:metadata.guest,organization:metadata.organization}});
  const dir=path.join(data,'element-work',key);return {state,q,key,dir,file:path.join(dir,'result.json')};
 }
 const result=p=>fs.existsSync(p.file)?JSON.parse(fs.readFileSync(p.file,'utf8')):{key:p.key,reason:'',items:[],status:'none'};
 function read(input){const p=scope(input),r=result(p);if(r.status==='working'&&!pending.has(p.dir))r.status='interrupted';return r;}
 function fresh(input){const p=scope(input);if(p.key!==input.key)throw Error('De knip of brontekst is gewijzigd. Vraag opnieuw voorstellen; je montage is behouden.');return p;}
 async function generate(input){
  const p=scope(input);if(pending.has(p.dir))return pending.get(p.dir);
  const saved=result(p);if(saved.status==='ready'&&!saved.items.some(i=>i.creationError&&i.status!=='rejected'))return saved;
  const work=(async()=>{
   fs.mkdirSync(p.dir,{recursive:true});
   const ideas=await planner(root,input,p.state,catalog,model);
   const output=saved.status!=='none'?saved:{key:p.key,reason:ideas.reason,items:ideas.items.map((item,index)=>({...item,proposalId:String(index),status:'pending',element:null})),createdAt:new Date().toISOString()};
   output.status='working';writeJSON(p.file,output);
   for(const item of output.items){
    if(item.element||item.status==='rejected')continue;
    try{
     const e={type:item.type,layout:['proof','annotatedProof'].includes(item.type)?'inset':'side',...elementTiming(p.q,catalog,item.basis,item.type),text:item.text,value:item.value,label:item.label,source:['comparison','diagram'].includes(item.type)?'Volgens de spreker':item.source,assetId:null,artworkId:null};
     if(item.type==='comparison')e.comparison=item.comparison;
     if(item.type==='diagram')e.diagram=item.diagram;
     if(['proof','annotatedProof'].includes(item.type))Object.assign(e,await evidence(root,path.join(p.dir,'bewijs-'+item.proposalId),item,{title:catalog.title,details:catalog.details,guest:metadata.guest,organization:metadata.organization,existingEvidence:Object.values(p.state.modes).flatMap(m=>Object.values(m.edits||{})).map(e=>e.element).filter(e=>e?.assetId&&e.source).map(e=>({assetId:e.assetId,source:e.source,sourceUrl:e.sourceUrl||'',text:e.text}))},{model}));
     validateElement({...e,artworkId:'0'.repeat(64)});
     item.element=e;delete item.creationError;
    }catch(error){item.creationError=error.message;}
    writeJSON(p.file,output);
   }
   fresh({...input,key:p.key});output.status='ready';writeJSON(p.file,output);return output;
  })();pending.set(p.dir,work);try{return await work;}finally{pending.delete(p.dir);}
 }
 function decide(input){
  const p=fresh(input),output=result(p),item=output.items.find(i=>i.proposalId===input.proposalId);
  if(!item||!['draft','reject','approve'].includes(input.action))throw Error('Onbekend voorstel of besluit');
  if(pending.has(p.dir))throw Error('Wacht tot de voorstellen klaar zijn.');
  if(input.action==='reject'){if(item.status==='approved')throw Error('Dit element is al toegepast. Verwijder het via Element weglaten.');item.status='rejected';item.decidedAt=new Date().toISOString();writeJSON(p.file,output);return {proposal:item,result:output};}
  const e=input.element;validateElement(e);
  if(!e||e.end>p.q.end-p.q.start+.00001)throw Error('Houd het element binnen dit fragment');
  for(const id of [e.artworkId,e.assetId].filter(Boolean)){const bytes=fs.readFileSync(assets.file(id));if(createHash('sha256').update(bytes).digest('hex')!==id)throw Error('Elementbeeld ontbreekt of is gewijzigd');}
  if(input.action==='draft'){if(['approved','rejected'].includes(item.status))throw Error('Dit voorstel is al afgehandeld.');item.element=e;item.status='draft';writeJSON(p.file,output);return {proposal:item,result:output};}
  if(digest(p.q.element||null)!==digest(input.currentElement??null))throw Error('Het element is intussen gewijzigd. Herlaad voordat je dit voorstel toepast.');
  if(item.status==='rejected')throw Error('Dit voorstel is afgekeurd. Maak een nieuw handmatig element als je terug wilt komen op die keuze.');
  if(item.status==='approved'&&digest(p.q.element)===digest(e))return {state:p.state,changed:false,proposal:item,result:output};
  const before=structuredClone(p.state),next=structuredClone(p.state),m=next.modes[input.mode],key=editKey(input.blockId,input.id);
  m.edits??={};m.edits[key]={start:p.q.start,end:p.q.end,nl:p.q.nl||'',translationReviewed:!!p.q.translationReviewed,...(p.q.translationRange?{translationRange:p.q.translationRange}:{}),...m.edits[key],element:e};
  validateEdits(m,catalog,input.mode);next.revision=(next.revision||0)+1;
  const restore=path.join(data,'herstel');fs.mkdirSync(restore,{recursive:true});fs.writeFileSync(path.join(restore,Date.now()+'-element.json'),fs.readFileSync(stateFile));
  const prior=structuredClone(output);item.element=e;item.status='approved';item.decidedAt=new Date().toISOString();
  try{writeJSON(stateFile,next);writeJSON(p.file,output);}catch(error){writeJSON(stateFile,before);writeJSON(p.file,prior);throw error;}
  return {state:next,before,changed:true,proposal:item,result:output};
 }
 return {read,generate,decide};
}
