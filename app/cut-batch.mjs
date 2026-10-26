import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {writeJSON} from './interviews.mjs';
import {cutProposalService} from './cut-proposal-service.mjs';
import {auditService} from './audio-audit.mjs';
import {montageReview,reviewSnapshot} from './public/export-status.mjs';
import {transitionTarget} from './public/transitions.mjs';

const active=new Map();
const scopeOf=value=>{if(value===undefined||value==='changes')return 'changes';if(value==='full')return 'full';throw Error('Kies gewijzigde plekken of een volledige herbeoordeling.');};
export const batchIsRunning=root=>['quoteverhaal','gespreksmontage'].some(mode=>['changes','full'].some(scope=>active.has(path.join(root,'data/cut-proposals','batch-'+mode+(scope==='full'?'-full':'')+'.json'))));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function batchTasks(state,catalog){
 const m=state.modes[state.mode],refs=[...m.teaser.map(id=>({id,blockId:'teaser',title:'Opening · teasers'})),...m.blocks.flatMap(b=>b.clipIds.map(id=>({id,blockId:b.id,title:b.title})))];
 return [...refs.map(r=>({...r,kind:'audio'})),...(catalog.hasVideo===false?[]:refs.filter(r=>transitionTarget(state,r.id,r.blockId)).map(r=>({...r,kind:'visual'})))].map(r=>({...r,taskId:r.kind+':'+r.blockId+':'+r.id}));
}

// Only changed ranges of existing selected occurrences trigger automatic work.
export function changedCutTasks(before,after,catalog){
 if(before.mode!==after.mode)return [];
 const old=new Map(reviewSnapshot(before,catalog).items.map(item=>[item.key,item])),now=reviewSnapshot(after,catalog).items;
 const changed=new Set(now.filter(item=>{const prior=old.get(item.key);return prior&&(prior.audio.start!==item.audio.start||prior.audio.end!==item.audio.end);}).map(item=>item.key));
 if(!changed.size)return [];
 const pictures=new Set(now.filter(item=>{const prior=old.get(item.key);return prior&&!same(prior.visual,item.visual)&&[item.key,item.visual.before?.key,item.visual.after?.key].some(key=>changed.has(key));}).map(item=>item.key));
 return batchTasks(after,catalog).filter(task=>(task.kind==='audio'?changed:pictures).has(task.blockId+':'+task.id)).map(task=>task.taskId);
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

// Separate persisted ordinary and explicit full rounds per montage mode. The worker only writes proposals and progress.
export function cutBatch(appRoot,root,catalog,source,metadata={},deps={}){
 const stateFile=path.join(root,'data/montages.json'),folder=path.join(root,'data/cut-proposals');
 const current=()=>JSON.parse(fs.readFileSync(stateFile,'utf8'));
 const context=deps.context||(()=>({catalog,exportSource:source,metadata}));
 const service=()=>{const c=context();return deps.service?deps.service(c):cutProposalService(appRoot,root,c.catalog,c.exportSource,c.metadata);};
 const location=(mode,scope='changes')=>path.join(folder,'batch-'+mode+(scope==='full'?'-full':'')+'.json');
 const load=(mode,scope='changes')=>fs.existsSync(location(mode,scope))?JSON.parse(fs.readFileSync(location(mode,scope),'utf8')):null;
 const save=job=>{fs.mkdirSync(folder,{recursive:true});writeJSON(location(job.mode,job.scope),{...job,updatedAt:new Date().toISOString()});};
 const eligible=(job,task)=>!job?.autoTargets||job.autoTargets.includes(task.taskId);
 const input=(s,t)=>({id:t.id,blockId:t.blockId,kind:t.kind,mode:s.mode,revision:s.revision});
 function inspect(job,scope='changes'){
  const s=current(),c=context(),svc=service(),prior=new Map((job?.tasks||[]).map(t=>[t.taskId,t]));
  const review=montageReview(s,c.catalog,auditService(appRoot,root,c.catalog,c.exportSource).read());
  const checked=new Map(review.items.map(item=>[item.key,item]));
  const tasks=batchTasks(s,c.catalog).map(ref=>{
   const old=prior.get(ref.taskId);let result;
   try{result=svc.read(input(s,ref));}catch(e){return {...ref,status:'error',error:e.message};}
   const task={...ref,key:result.key,identity:result.identity,attempts:old?.attempts||0};
   const decision=result.decision||svc.decision(old?.key);
   if(decision?.action==='apply'&&decision.afterIdentity===result.identity)return {...task,status:'applied'};
   if(decision?.action==='skip'&&(old?.identity===result.identity||old?.key===result.key||result.decision))return {...task,status:'skipped'};
   if(old?.identity===result.identity&&['applied','skipped'].includes(old.status))return {...task,status:old.status};
   // A valid human/baseline review outranks any cached AI suggestion.
   if(scope!=='full'&&checked.get(ref.blockId+':'+ref.id)?.[ref.kind])return {...task,status:'reviewed'};
   if(old?.identity===result.identity&&old.status==='unchanged')return {...task,status:old.status};
   if(result.status==='ready')return {...task,status:same(result.draft,result.current)?'unchanged':'ready',result};
   if(old?.key===result.key&&['working','error'].includes(old.status))return {...task,status:old.status==='working'&&!eligible(job,task)?'deferred':old.status,...(old.error?{error:old.error}:{})};
   return {...task,status:eligible(job,task)?'pending':'deferred',...(old?.identity===result.identity&&old.result?.adjusted?{carryDraft:old.result.draft}:old?.carryDraft?{carryDraft:old.carryDraft}:{})};
  });
  const count=status=>tasks.filter(t=>t.status===status).length;
  const totals={total:tasks.length,pending:count('pending'),working:count('working'),proposals:count('ready'),unchanged:count('unchanged'),reviewed:count('reviewed'),deferred:count('deferred'),applied:count('applied'),skipped:count('skipped'),errors:count('error')};
  const running=job&&active.has(location(job.mode,scope)),pending=totals.pending+totals.working;
  const status=!job?'none':job.mode!==s.mode?'other-mode':job.status==='stopped'?'stopped':running?'running':['running','interrupted'].includes(job.status)?'interrupted':pending?'outdated':totals.errors?'partial':'complete';
  return {...(job||{}),mode:s.mode,scope,status,inFlight:!!running,tasks,totals,phase:tasks.find(t=>['working','pending'].includes(t.status))?.kind||null};
 }
 function read(request={}){const scope=scopeOf(request.scope);return inspect(load(current().mode,scope),scope);}
 function start(request){
  const s=current();if(s.mode!==request.mode||s.revision!==request.revision)throw Error('De montage is gewijzigd. Herlaad voordat je de ronde start.');
  if(!['quoteverhaal','gespreksmontage'].includes(s.mode))throw Error('Kies een montagevorm.');
  const scope=scopeOf(request.scope),file=location(s.mode,scope),old=load(s.mode,scope);if(request.batchId&&old?.id!==request.batchId)throw Error('Dit is een eerdere voorstelronde. Heropen het overzicht.');
  if(active.has(file))return read({scope});
  if(batchIsRunning(root))throw Error('Er loopt al een voorstelronde voor dit interview. Rond die eerst af of stop de ronde.');
  const view=inspect(old,scope);if(!view.tasks.length)throw Error('Kies eerst fragmenten voor je montage.');
  const job={id:old?.id||randomUUID(),mode:s.mode,scope,...(request.targeted&&old?.autoTargets?{autoTargets:old.autoTargets,automatic:true}:{}),status:'running',startedAt:old?.startedAt||new Date().toISOString(),tasks:view.tasks.map(t=>({...t,status:['working','error','deferred'].includes(t.status)?'pending':t.status,attempts:0}))};
  save(job);
  launch(job);return read({scope});
 }
 function launch(job){
  const {mode,scope='changes'}=job,file=location(mode,scope);
  if(active.has(file))return;
  const blockers=[...active].filter(([key])=>key.startsWith(folder+path.sep)).map(([,work])=>work);
  const work=Promise.all(blockers).then(()=>run(job.id,mode,scope)).catch(e=>{const latest=load(mode,scope);if(latest?.id===job.id){latest.status='interrupted';latest.message=e.message;save(latest);}}).finally(()=>active.delete(file));
  active.set(file,work);
 }
 function afterManualEdit(before,after){
  const targets=changedCutTasks(before,after,context().catalog);if(!targets.length)return null;
  const old=load(after.mode),file=location(after.mode),live=active.has(file),view=inspect(old);
  const autoTargets=live&&!old.autoTargets?null:[...new Set([...(live?old.autoTargets||[]:[]),...targets])];
  const job={id:old?.id||randomUUID(),mode:after.mode,scope:'changes',automatic:!!autoTargets,status:'running',startedAt:old?.startedAt||new Date().toISOString(),notBefore:Date.now()+(deps.delayMs??1500),...(autoTargets?{autoTargets}:{}),tasks:view.tasks.map(task=>({...task,status:targets.includes(task.taskId)&&['error','deferred'].includes(task.status)?'pending':task.status,...(targets.includes(task.taskId)?{attempts:0}:{})}))};
  save(job);launch(job);return read();
 }
 async function run(id,mode,scope){
  for(;;){
   let job=load(mode,scope);if(job?.id!==id||job.status!=='running')return;
   if(job.notBefore>Date.now()){await sleep(Math.min(job.notBefore-Date.now(),1500));continue;}
   if(current().mode!==mode){job.status='interrupted';job.message='Montagevorm gewisseld. Hervat wanneer je terug bent.';save(job);return;}
   const view=inspect(job,scope);job.tasks=view.tasks;
   const task=job.tasks.find(t=>t.status==='pending'&&eligible(job,t));
   if(!task){job.status=job.tasks.some(t=>t.status==='error')?'partial':'complete';delete job.message;save(job);return;}
   if(task.attempts>=2){task.status='error';task.error='Deze plek veranderde herhaaldelijk tijdens de ronde. Werk de ronde bij zodra je klaar bent met redigeren.';save(job);continue;}
   const s=current(),svc=service();task.status='working';task.attempts++;save(job);
   try{
    await svc.generate(input(s,task));
    if(task.carryDraft){const now=current();const latest=svc.read(input(now,task));if(latest.identity===task.identity)svc.decide({...input(now,task),key:latest.key,action:'draft',draft:task.carryDraft});}
   }catch(e){
    job=load(mode,scope);if(job?.id!==id||job.status!=='running')return;
    const entry=job.tasks.find(t=>t.taskId===task.taskId);if(!entry)continue;
    if(!/OpenAI|sleutel|tegoed/i.test(e.message)&&current().mode===mode){const latest=svc.read(input(current(),task));if(latest.key!==task.key){entry.status='pending';delete entry.error;save(job);continue;}}
    entry.status='error';entry.error=e.message;
    // Stop on provider failures; do not spend on the rest of a broken connection.
    if(/OpenAI|sleutel|tegoed/i.test(e.message)){job.status='interrupted';job.message=e.message;save(job);return;}
    save(job);continue;
   }
   job=load(mode,scope);if(job?.id!==id||job.status!=='running')return;
   const entry=job.tasks.find(t=>t.taskId===task.taskId);if(!entry)continue;entry.status='pending';delete entry.error;
   if(current().mode===mode){const latest=svc.read(input(current(),task));if(latest.key!==task.key&&task.attempts>=2){entry.status='error';entry.error='Dit fragment veranderde tijdens de ronde. Werk de ronde bij zodra je klaar bent met redigeren.';}}
   save(job);
  }
 }
 function refreshAfterDecision(request,response,before){
  const old=['changes','full'].map(scope=>load(current().mode,scope)).find(job=>job?.id===request.batchId);
  if(request.action==='apply'&&response.changed){
   if(old?.scope==='full')return start({mode:response.state.mode,revision:response.state.revision,batchId:old.id,scope:'full'});
   if(before)return afterManualEdit(before,response.state)||read();

  }
  return old?read({scope:old.scope}):null;
 }
 function stop(request){const s=current(),scope=scopeOf(request.scope),job=load(s.mode,scope);if(!job||job.id!==request.batchId)throw Error('Deze voorstelronde is niet meer actueel.');job.status='stopped';save(job);return read({scope});}
 return {read,start,stop,afterManualEdit,refreshAfterDecision,settled:(scope='changes')=>active.get(location(current().mode,scope))||Promise.resolve()};
}
