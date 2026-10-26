export const SPEAKER_ROLES={unknown:'Nog kiezen',interviewer:'Interviewer',guest:'Geïnterviewde',other:'Overig'};
const overlap=(a,b)=>Math.max(0,Math.min(a.end,b.end)-Math.max(a.start,b.start));
export function speakerSummary(catalog,q){
 const d=catalog.speakers;
 if(!d||d.status!=='complete')return {label:q.speaker||'Spreker',role:catalog.imported?'unknown':q.speaker==='Interviewer'?'interviewer':'guest',guestOnly:!catalog.imported&&q.speaker!=='Interviewer',ids:[]};
 const totals=new Map();let covered=0,last=q.start;
 const spans=d.turns.filter(t=>overlap(t,q)>0).sort((a,b)=>a.start-b.start);
 for(const t of spans){totals.set(t.speakerId,(totals.get(t.speakerId)||0)+overlap(t,q));const start=Math.max(q.start,t.start),end=Math.min(q.end,t.end);covered+=Math.max(0,end-Math.max(last,start));last=Math.max(last,end);}
 const ids=[...totals].filter(([,seconds])=>seconds>=.08).map(([id])=>id),voices=ids.map(id=>d.voices.find(v=>v.id===id)).filter(Boolean),roles=new Set(voices.map(v=>v.role));
 const label=voices.length?[...new Set(voices.map(v=>v.name||v.label))].join(' + '):'Stem niet herkend';
 // Short interruptions count too. Never label a question-and-answer passage guest-only.
 return {label,role:roles.size===1?[...roles][0]:voices.length?'mixed':'unknown',guestOnly:!!voices.length&&roles.size===1&&roles.has('guest')&&covered>=(q.end-q.start)*.65,ids};
}
export function mayProposeQuote(catalog,q){return speakerSummary(catalog,q).guestOnly;}

// A teaser may contain a brief overlapping acknowledgement; it remains labelled mixed.
export function mayProposeTeaser(catalog,q){
 if(mayProposeQuote(catalog,q))return true;
 const d=catalog.speakers;if(d?.status!=='complete'||q.text?.includes('?'))return false;
 const role=id=>d.voices.find(v=>v.id===id)?.role;
 const spans=d.turns.filter(t=>overlap(t,q)>0).map(t=>({...t,start:Math.max(t.start,q.start),end:Math.min(t.end,q.end)}));
 if(spans.some(t=>!['guest','interviewer'].includes(role(t.speakerId))))return false;
 const guests=spans.filter(t=>role(t.speakerId)==='guest').sort((a,b)=>a.start-b.start),merged=[];
 for(const t of guests){const last=merged.at(-1);if(last&&t.start<=last.end)last.end=Math.max(last.end,t.end);else merged.push({start:t.start,end:t.end});}
 const duration=q.end-q.start,guestTime=merged.reduce((n,t)=>n+t.end-t.start,0),other=spans.filter(t=>role(t.speakerId)==='interviewer');
 return duration>0&&guestTime/duration>=.9&&other.length>0&&other.reduce((n,t)=>n+t.end-t.start,0)<=Math.min(1,duration*.15)&&other.every(t=>t.end-t.start<=.6&&merged.reduce((n,g)=>n+overlap(g,t),0)/(t.end-t.start)>=.6);
}
