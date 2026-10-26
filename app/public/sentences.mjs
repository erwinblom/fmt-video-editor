// Transcript-based sentence boundaries are editorial hints, never proof from audio.
const cache=new WeakMap();
const closes=text=>/[.!?]["'”’)}\]]*$/.test(text.trim())&&!/^(?:mr|mrs|ms|dr|prof|vs|etc|e\.g|i\.e)\.$/i.test(text.trim())&&!/^(?:[A-Z]\.){1,4}$/.test(text.trim());
const rounded=n=>Math.round(n*1000)/1000;
export function sentenceIndex(catalog){
 if(cache.has(catalog))return cache.get(catalog);
 const words=(catalog.words||[]).filter(w=>Number.isFinite(w.start)&&Number.isFinite(w.end)&&w.end>w.start&&w.text?.trim());
 const sentences=[],byWord=new Map();let group=[],turn=0,lastSpeaker=null;
 function finish(endKnown){if(!group.length)return;const first=group[0],last=group.at(-1),before=words[words.indexOf(first)-1],after=words[words.indexOf(last)+1];sentences.push({turn,speaker:first.speaker,start:first.start,end:last.end,text:group.map(w=>w.text).join('').trim(),first,last,startKnown:!before||closes(before.text),endKnown,overlapStart:!!before&&before.end>first.start+.025,overlapEnd:!!after&&after.start<last.end-.025,previousEnd:before?.end,nextStart:after?.start});for(const w of group)byWord.set(w,sentences.at(-1));group=[];}
 for(const w of words){if(lastSpeaker!==null&&lastSpeaker!==w.speaker){finish(false);turn++;}lastSpeaker=w.speaker;group.push(w);if(closes(w.text))finish(true);}finish(false);
 const result={words,sentences,byWord};cache.set(catalog,result);return result;
}
function edgeFinding(catalog,q,side){
 const {words,sentences,byWord}=sentenceIndex(catalog),isStart=side==='start',included=words.filter(w=>(catalog.imported||w.speaker===q.speaker)&&w.end>q.start+.025&&w.start<q.end-.025);
 if(!included.length)return {status:'unknown',message:'Geen bruikbare woordtijdcodes',candidates:[]};
 const edge=isStart?included[0]:included.at(-1),sentence=byWord.get(edge);
 if(!sentence)return {status:'unknown',message:'Zinsgrens niet herleidbaar',candidates:[]};
 const cutWord=isStart?q.start>edge.start+.025:q.end<edge.end-.025;
 const boundaryWord=isStart?edge===sentence.first:edge===sentence.last;
 const known=isStart?sentence.startKnown:sentence.endKnown;
 const overlap=isStart?sentence.overlapStart:sentence.overlapEnd;
 const status=cutWord||!boundaryWord?'inside':!known||overlap?'unknown':'ok';
 const label=isStart?'Begin':'Einde';let message=status==='inside'?`${label} midden in ${cutWord?'een woord / zin':'een zin'}`:status==='unknown'?`${label} onzeker: ${overlap?'woordtijdcodes overlappen':'geen duidelijk leesteken'}`:`${label} op zinsgrens volgens transcript`;
 const available=sentences.filter(s=>s.turn===sentence.turn&&(catalog.imported||s.speaker===q.speaker)&&(isStart?s.start<q.end-.04:s.end>q.start+.04));
 const values=available.map(s=>{
  const raw=isStart?s.start:s.end;
  const uncertain=(isStart?!s.startKnown:!s.endKnown)||(isStart?s.overlapStart:s.overlapEnd);
  const value=rounded(isStart?Math.max(0,s.start-.04,s.previousEnd??0):Math.min(catalog.duration,s.end+.04,s.nextStart??Infinity));
  return {value,raw,text:s.text,uncertain,reason:uncertain?'Tijdcode of zinsgrens onzeker; eerst beluisteren':'Voorstel op basis van brontranscript',distance:Math.abs(raw-q[side]),expands:isStart?value<q.start:value>q.end};
 }).filter(c=>Math.abs(c.value-q[side])>.025&&c.distance<=30).sort((a,b)=>a.distance-b.distance);
 // Offer one earlier and one later boundary, including uncertain ones visibly.
 const candidates=[];for(const before of [true,false]){const c=values.find(c=>before?c.value<q[side]:c.value>q[side]);if(c)candidates.push(c);}
 return {status,message,word:edge.text.trim(),sentence:sentence.text,candidates:candidates.sort((a,b)=>a.distance-b.distance)};
}
export function sentenceCheck(catalog,q){
 const start=edgeFinding(catalog,q,'start'),end=edgeFinding(catalog,q,'end');
 const exception=q.sentenceException?.start===q.start&&q.sentenceException?.end===q.end;
 return {start,end,flagged:start.status!=='ok'||end.status!=='ok',exception};
}
export function selectionSentenceAudit(state,catalog,resolve){
 const m=state.modes[state.mode];return [...m.teaser.map(id=>({id,blockId:'teaser',title:'Teaser'})),...m.blocks.flatMap(b=>b.clipIds.map(id=>({id,blockId:b.id,title:b.title})))].map(ref=>{const q=resolve(state,catalog,ref.id,ref.blockId);return {...ref,speaker:q.speaker,sourceStart:q.start,sourceEnd:q.end,...sentenceCheck(catalog,q)};});
}
