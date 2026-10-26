import {resolveFraming} from './framing.mjs';
import {resolveQuote} from './model.mjs';
// Compare what the viewer will see/hear, independent of saves and other montage modes.
export function montageSignature(state,catalog){
 const m=state.modes[state.mode],clip=(id,blockId)=>{const q=resolveQuote(state,catalog,id,blockId);return {id,start:q.start,end:q.end,nl:q.nl||'',subtitleTiming:q.subtitleTiming||null,...(q.element?{element:q.element}:{}),...(q.transition?.frames?{transition:q.transition}:{}),crop:resolveFraming(state,catalog,id,blockId).crop};};
 return JSON.stringify({pipeline:8,subtitlesEnabled:m.subtitlesEnabled!==false,...(catalog.imported?{source:{title:catalog.title,details:catalog.details,hasVideo:catalog.hasVideo,framing:catalog.framing}}:{}),mode:state.mode,subtitleLanguage:m.subtitleLanguage||'nl',teaser:m.teaser.map(id=>clip(id,'teaser')),blocks:m.blocks.map(b=>({id:b.id,title:b.title,clips:b.clipIds.map(id=>clip(id,b.id))}))});
}
export function videoIsCurrent(job,state,catalog){return job?.status==='complete'&&job.mode===state.mode&&job.signature===montageSignature(state,catalog);}

// Review validity follows the content at each occurrence, never a global revision number.
export function reviewSnapshot(state,catalog){
 const m=state.modes[state.mode],refs=[...m.teaser.map(id=>({id,blockId:'teaser',title:'Opening · teasers'})),...m.blocks.flatMap(b=>b.clipIds.map(id=>({id,blockId:b.id,title:b.title})))];
 const items=refs.map(ref=>{const q=resolveQuote(state,catalog,ref.id,ref.blockId);return {...ref,key:ref.blockId+':'+ref.id,audio:{start:q.start,end:q.end,text:q.nl||'',language:m.subtitleLanguage||'nl',timing:q.subtitleTiming?{start:q.subtitleTiming.start,end:q.subtitleTiming.end,text:q.subtitleTiming.text,cues:q.subtitleTiming.cues.map(c=>({start:c.start,end:c.end,text:c.text}))}:null},picture:{start:q.start,end:q.end,crop:resolveFraming(state,catalog,ref.id,ref.blockId).crop},transition:q.transition};});
 return {mode:state.mode,items:items.map((x,i)=>{
  const prev=items[i-1],next=items[i+1],before=prev?.blockId===x.blockId?{key:prev.key,...prev.picture}:{kind:x.blockId==='teaser'?'opening':'card',blockId:x.blockId},after=next?.blockId===x.blockId?{key:next.key,...next.picture}:{kind:x.blockId==='teaser'?'intro':next?'card':'outro',blockId:next?.blockId||null};
  const nextId=next?.blockId===x.blockId?next.id:next&&x.blockId!=='teaser'?'topic:'+next.blockId:null;
  return {key:x.key,id:x.id,blockId:x.blockId,title:x.title,audio:x.audio,visual:{...x.picture,before,after,frames:nextId&&x.transition?.nextId===nextId?x.transition.frames:0}};
 })};
}
export function reviewedAudio(q,audit,key){
 if(!audit||audit.reviewSourceChanged||!['ready','review'].includes(audit.status))return false;
 return audit.checked?.some(x=>(!key||x.key===key)&&x.start===q.start&&x.end===q.end&&x.text===(q.nl||'')&&(!x.language||x.language===(q.subtitleLanguage||'nl'))&&(!x.timing||JSON.stringify(x.timing)===JSON.stringify(q.subtitleTiming||null))&&!audit.issues?.some(i=>i.key===x.key&&!i.resolved))||false;
}
export function montageReview(state,catalog,audit){
 const now=reviewSnapshot(state,catalog),baseline=audit?.montageReview?.modes?.[state.mode],sourceOK=!audit?.reviewSourceChanged,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),old=new Map((baseline?.items||[]).map(x=>[x.key,x]));
 const items=now.items.map(x=>{
  const prior=old.get(x.key),humanAudio=sourceOK&&prior?.audioReview?.method==='human'&&same(x.audio,prior.audio),fresh=audit?.checked?.find(c=>c.key===x.key&&c.timing&&c.language),pending=audit?.mode===state.mode&&audit.issues?.some(i=>i.key===x.key&&!i.resolved)&&!(humanAudio&&prior.audioReview.auditId===(audit.id||null)),audio=!pending&&sourceOK&&(prior&&same(x.audio,prior.audio)||audit?.mode===state.mode&&reviewedAudio({start:x.audio.start,end:x.audio.end,nl:x.audio.text,subtitleTiming:x.audio.timing,subtitleLanguage:x.audio.language},audit,x.key)&&(fresh||!prior||same(x.audio.timing,prior.audio.timing))&&(fresh||!prior||x.audio.language===prior.audio.language)),visual=sourceOK&&!!prior&&same(x.visual,prior.visual);
  const reasons=[];
  if(!audio)reasons.push(pending?'Onzekerheid in de audiocontrole':prior?'Audio of ondertitels gewijzigd':'Audio nog niet gecontroleerd');
  if(!visual&&baseline)reasons.push('Beeldovergang of uitsnede gewijzigd');
  return {...x,audio:!!audio,visual,audioHuman:!!audio&&humanAudio,visualHuman:visual&&prior?.visualReview?.method==='human',reasons};
 });
 return {items,hasBaseline:!!baseline,complete:!!baseline&&items.length>0&&items.every(x=>x.audio&&x.visual),audioComplete:items.length>0&&items.every(x=>x.audio),issues:items.filter(x=>x.reasons.length),sourceChanged:!!audit?.reviewSourceChanged};
}
