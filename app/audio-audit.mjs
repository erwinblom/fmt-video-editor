import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {subtitleSnapshot} from './subtitle-core.mjs';
import {resolveQuote,validateSubtitleTiming} from './public/model.mjs';
import {reviewService} from './review-service.mjs';
import {writeJSON} from './interviews.mjs';
export const AUDIT_VERSION=4;
export function auditSnapshot(state,catalog,source){
 const snap=subtitleSnapshot(state,catalog,{revision:state.revision??0,mode:state.mode,subtitleLanguage:state.modes[state.mode].subtitleLanguage||'nl'});
 snap.items=snap.items.map(item=>{const split=item.key.indexOf(':'),q=resolveQuote(state,catalog,item.clipId,item.key.slice(0,split));return {...item,nl:q.nl||'',timing:q.subtitleTiming||null};});
 const stat=fs.statSync(source);return {...snap,version:AUDIT_VERSION,source,sourceBytes:stat.size,sourceModified:stat.mtimeMs,metadata:catalog.details||{}};
}
export function auditHash(snapshot){const {revision,...content}=snapshot;return createHash('sha256').update(JSON.stringify(content)).digest('hex');}
export function validateAudit(value,item){
 if(!value||!Array.isArray(value.cues)||!value.cues.length||!Array.isArray(value.issues))throw Error('Audiocontrole gaf geen volledig resultaat.');
 const cues=value.cues.map(c=>({start:c.start,end:c.end,text:typeof c.text==='string'?c.text.trim():''}));
 const text=cues.map(c=>c.text).join(' ');if(text.length>20000)throw Error('Ondertitelantwoord is te lang.');
 validateSubtitleTiming({start:item.start,end:item.end,text,cues},item.end);
 for(const c of cues)if(c.text.length>250||(c.text.length/(c.end-c.start)>25))throw Error('Ondertitel te lang of te snel. Probeer de controle opnieuw.');
 const issues=value.issues.map((x,i)=>{if(!Number.isInteger(x.cue)||!cues[x.cue]||typeof x.reason!=='string'||!x.reason.trim()||x.reason.length>600||typeof x.word!=='string'||x.word.length>200)throw Error('Ongeldig twijfelgeval.');let cue=x.cue;if(x.text!==undefined){if(typeof x.text!=='string')throw Error('Twijfelgeval mist de exacte ondertitel.');if(cues[cue].text!==x.text.trim()){const exact=cues.flatMap((c,n)=>c.text===x.text.trim()?[n]:[]);if(exact.length!==1)throw Error('Twijfelgeval verwijst niet naar een unieke ondertitel.');cue=exact[0];}}const word=x.word.trim().toLocaleLowerCase();if(word&&!cues[cue].text.toLocaleLowerCase().includes(word)){const matches=cues.flatMap((c,n)=>c.text.toLocaleLowerCase().includes(word)?[n]:[]);if(matches.length===1)cue=matches[0];}return {id:String(i),cue,text:cues[cue].text,reason:x.reason,word:x.word};});
 const grouped=new Map();for(const issue of issues){const prior=grouped.get(issue.cue);if(prior){if(!prior.word.includes(issue.word))prior.word+=', '+issue.word;if(!prior.reason.includes(issue.reason))prior.reason+=' '+issue.reason;}else grouped.set(issue.cue,issue);}
 return {key:item.key,start:item.start,end:item.end,text,cues,issues:[...grouped.values()]};
}
export function applyAudit(state,result){
 const next=structuredClone(state),edits=next.modes[next.mode].edits;
 for(const item of result){const old=edits[item.key]||{};edits[item.key]={...old,start:item.start,end:item.end,nl:item.text,subtitleLanguage:next.modes[next.mode].subtitleLanguage||'nl',translationReviewed:false,subtitleBaseline:old.subtitleBaseline??old.nl??'',subtitleTiming:{start:item.start,end:item.end,text:item.text,cues:item.cues}};delete edits[item.key].translationRange;}
 next.revision=(next.revision??0)+1;return next;
}
export function auditService(appRoot,projectRoot,catalog,source){
 const data=path.join(projectRoot,'data'),file=path.join(data,'audio-audit.json'),stateFile=path.join(data,'montages.json');
 const current=()=>JSON.parse(fs.readFileSync(stateFile,'utf8'));
 const hash=()=>auditHash(auditSnapshot(current(),catalog,source));
 const withReview=reviewService(projectRoot,catalog,source).decorate;

 function read(){if(!fs.existsSync(file))return withReview({status:'none'});const j=JSON.parse(fs.readFileSync(file,'utf8'));
  if(j.status==='running'){try{process.kill(j.pid,0);}catch{j.status='failed';j.message='Audiocontrole onderbroken. Start opnieuw.';writeJSON(file,j);}}
  if(['ready','review'].includes(j.status)){let matches=false;try{matches=j.hash===hash();}catch{}if(!matches)return withReview({...j,status:'stale',message:'De montage is gewijzigd. Start de audiocontrole opnieuw.'});}
  return withReview(j);
 }
 function start(revision){const state=current();if(state.revision!==revision)throw Error('Montage gewijzigd. Herlaad en probeer opnieuw.');const old=read();if(['running','ready','review'].includes(old.status))return old;
  const snapshot=auditSnapshot(state,catalog,source),id=randomUUID(),dir=path.join(data,'audio-audits',id);fs.mkdirSync(dir,{recursive:true});writeJSON(path.join(dir,'snapshot.json'),snapshot);
  const job={id,status:'running',hash:auditHash(snapshot),revision,mode:state.mode,message:'Audio onafhankelijk controleren',issues:[],createdAt:Date.now()};writeJSON(file,job);
  const log=fs.openSync(path.join(dir,'worker.log'),'a'),child=spawn(process.execPath,[path.join(appRoot,'run-audio-audit.mjs'),projectRoot,id],{stdio:['ignore',log,log],detached:true});fs.closeSync(log);job.pid=child.pid;writeJSON(file,job);child.on('error',()=>writeJSON(file,{...job,status:'failed',message:'Audiocontrole kon niet starten.'}));child.unref();return job;
 }
 function resolve(input){const j=read();if(j.status!=='review'||j.id!==input.id)throw Error('Deze controle is gewijzigd. Start opnieuw.');const state=current();if(input.revision!==state.revision)throw Error('Montage gewijzigd. Herlaad eerst.');
  const issue=j.issues.find(x=>x.id===input.issueId&&!x.resolved);if(!issue)throw Error('Twijfelgeval niet meer open.');
  if(typeof input.text!=='string'||!input.text.trim()||input.text.length>250)throw Error('Vul een korte, volledige ondertitel in.');
  const e=state.modes[state.mode].edits[issue.key],cue=e.subtitleTiming.cues[issue.cue];cue.text=input.text.trim();e.nl=e.subtitleTiming.cues.map(c=>c.text).join(' ');e.subtitleTiming.text=e.nl;validateSubtitleTiming(e.subtitleTiming,catalog.duration);
  if(cue.text.length/(cue.end-cue.start)>25)throw Error('Deze tekst is te lang voor het luisterfragment. Maak de zin korter.');
  state.revision++;backupState(data,state);for(const x of j.issues)if(x.key===issue.key&&x.cue===issue.cue)x.text=cue.text;if(j.checked){const c=j.checked.find(x=>x.key===issue.key);if(c){c.text=e.nl;if(c.timing)c.timing=structuredClone(e.subtitleTiming);}}issue.resolved=true;issue.resolvedText=cue.text;issue.resolvedAt=Date.now();j.hash=auditHash(auditSnapshot(state,catalog,source));j.revision=state.revision;j.status=j.issues.every(x=>x.resolved)?'ready':'review';j.message=j.status==='ready'?'Audiocontrole afgerond.':'Controleer alleen de twijfelgevallen.';writeJSON(file,j);return {...j,state};
 }
 return {read,start,resolve,assertReady(){const j=read();if(j.status!=='ready'||!Array.isArray(j.issues)||j.issues.some(x=>!x.resolved))throw Error('Controleer eerst de audio en handel de onzekere woorden af.');}};
}
export function backupState(data,state){const file=path.join(data,'montages.json'),dir=path.join(data,'herstel');fs.mkdirSync(dir,{recursive:true});fs.copyFileSync(file,path.join(dir,`${Date.now()}-audio.json`));writeJSON(file,state);}
