import {resolveQuote,validateRange,wordBounds,validateEdits} from './public/model.mjs';
import {transitionTarget} from './public/transitions.mjs';
import {exportPlan} from './export-plan.mjs';

export function cutContext(state,catalog,input){
 if(input.mode!==state.mode||input.revision!==state.revision)throw Error('De montage is gewijzigd. Herlaad de editor voordat je voorstellen beoordeelt.');
 if(!['audio','visual'].includes(input.kind))throw Error('Kies audio of beeld.');
 const m=state.modes[state.mode],refs=[...m.teaser.map(id=>({id,blockId:'teaser',title:'Opening · teasers'})),...m.blocks.flatMap(b=>b.clipIds.map(id=>({id,blockId:b.id,title:b.title})))];
 const ref=refs.find(x=>x.id===input.id&&x.blockId===input.blockId);if(!ref)throw Error('Dit fragment staat niet meer op deze plek.');
 const q=resolveQuote(state,catalog,input.id,input.blockId),target=transitionTarget(state,input.id,input.blockId);
 if(input.kind==='visual'&&(catalog.hasVideo===false||!target))throw Error('Hier is geen verplaatsbare beeldwissel. Je kunt wel de audioknip beoordelen.');
 const plan=exportPlan(state,catalog,{preview:true}),index=plan.events.findIndex(e=>e.kind==='clip'&&e.id===ref.id&&e.blockId===ref.blockId),event=plan.events[index],next=plan.events[index+1],cut=plan.visualCuts.find(c=>c.id===ref.id&&c.blockId===ref.blockId);
 return {ref,q,target,event,next,cut,plan};
}

export function audioOptions(q,words,silences,duration){
 const active=words.filter(w=>w.start<q.end-.02&&w.end>q.start+.02&&w.text?.trim()),first=active[0],last=active.at(-1);
 const choices=[{id:'keep',start:q.start,end:q.end}];if(!first||!last)return choices;
 const silent=t=>silences.some(s=>s.start<=t-.008&&s.end>=t+.008);
 const edges=(edge,word)=>{
  const original=q[edge],out=[];
  for(let frame=-12;frame<=12;frame++){
   const t=Math.round((original+frame/25)*1000)/1000;
   if(!frame||t<0||t>duration||!silent(t))continue;
   if(edge==='start'&&(t<first.start-.2||t>first.start-.015)||edge==='end'&&(t<last.end+.015||t>last.end+.24))continue;
   if(words.some(w=>w.start+.005<t&&w.end-.005>t))continue;
   if(edge==='start'&&words.some(w=>w.end>t&&w.end<=q.start-.02)||edge==='end'&&words.some(w=>w.start< t&&w.start>=q.end+.02))continue;
   out.push(t);
  }
  // Recover a word cut in half even when continuous speech has no silent gap.
  const recovery=edge==='start'?word.start:word.end;
  if(word.start+.025<original&&original<word.end-.025&&Math.abs(recovery-original)<=.480001&&!words.some(w=>w!==word&&w.start+.005<recovery&&w.end-.005>recovery))out.push(Math.round(recovery*1000)/1000);
  return [...new Set(out)].sort((a,b)=>Math.abs(a-(edge==='start'?word.start-.06:word.end+.10))-Math.abs(b-(edge==='start'?word.start-.06:word.end+.10))).slice(0,3);
 };
 for(const start of [q.start,...edges('start',first)])for(const end of [q.end,...edges('end',last)]){
  if(start===q.start&&end===q.end||end-start<.04)continue;
  choices.push({id:'audio-'+choices.length,start,end});
 }
 return choices;
}

export function visualOptions(context){
 const c=context.cut,current=c.frames;
 return [...new Set([current,-12,-8,-4,0,4,8,12])].filter(n=>n>=c.min&&n<=c.max).map((frames,i)=>({id:i===0?'keep':'visual-'+i,frames,nextShot:context.target.kind==='clip'?(context.next.framing.manual?context.next.framing.shot:'auto'):null}));
}

export function cutWords(range,words){return ['start','end'].flatMap(edge=>words.filter(w=>w.start+.025<range[edge]&&range[edge]<w.end-.025).map(w=>({edge,position:range[edge],text:w.text,start:w.start,end:w.end})));}

// Change only the selected domain. Captions retain their text and interior timing.
export function proposalDraft(state,catalog,input,draft){
 const c=cutContext(state,catalog,input),next=structuredClone(state),m=next.modes[next.mode],key=c.ref.blockId+':'+c.ref.id,q=c.q;
 const edit={start:q.start,end:q.end,nl:q.nl||'',translationReviewed:!!q.translationReviewed,...(q.translationRange?{translationRange:q.translationRange}:{}),...(q.subtitleTiming?{subtitleTiming:structuredClone(q.subtitleTiming)}:{}),...(m.edits?.[key]||{})};
 if(input.kind==='audio'){
  if(!draft||Object.keys(draft).some(k=>!['start','end'].includes(k)))throw Error('Ongeldig audiovoorstel.');
  validateRange(draft.start,draft.end,catalog.duration);
  if(Math.abs(draft.start-q.start)>.480001||Math.abs(draft.end-q.end)>.480001)throw Error('Verstel maximaal twaalf frames per grens.');
  if(draft.start!==q.start||draft.end!==q.end){
   edit.start=draft.start;edit.end=draft.end;edit.translationReviewed=false;delete edit.translationRange;delete edit.sentenceException;
   edit.wordBounds=wordBounds({...q,start:draft.start,end:draft.end});
   if(edit.subtitleTiming){
    const t=structuredClone(edit.subtitleTiming);t.start=draft.start;t.end=draft.end;
    for(const cue of t.cues){cue.start=Math.max(t.start,cue.start);cue.end=Math.min(t.end,cue.end);if(cue.end-cue.start<.04)throw Error('Dit snijdt een ondertitel weg. Stel de knip handmatig verder af.');}
    t.cues[0].start=t.start;t.cues.at(-1).end=t.end;edit.subtitleTiming=t;
   }
  }
 }else{
  if(!draft||Object.keys(draft).some(k=>!['frames','nextShot'].includes(k))||!Number.isInteger(draft.frames)||draft.frames<c.cut.min||draft.frames>c.cut.max)throw Error('Kies een beeldwissel binnen de beschikbare frames.');
  edit.transition={nextId:c.target.nextId,frames:draft.frames};
  if(c.target.kind==='clip'){
   const shot=draft.nextShot;if(!['auto','wide','medium','close'].includes(shot)||shot!=='auto'&&state.guestFrames&&!state.guestFrames[shot])throw Error('Kies een ingestelde uitsnede.');
   const nkey=c.ref.blockId+':'+c.target.nextId,nq=resolveQuote(next,catalog,c.target.nextId,c.ref.blockId),ne={start:nq.start,end:nq.end,nl:nq.nl||'',translationReviewed:!!nq.translationReviewed,...(nq.translationRange?{translationRange:nq.translationRange}:{}),...(m.edits?.[nkey]||{})};
   if(shot==='auto')delete ne.shot;else ne.shot=shot;m.edits??={};m.edits[nkey]=ne;
  }else if(draft.nextShot!==null)throw Error('Een hoofdstukkaart heeft geen gastuitsnede.');
 }
 m.edits??={};m.edits[key]=edit;validateEdits(m,catalog,next.mode);return next;
}
