// A cut moves on the picture timeline only. Source clocks stay tied to audio.
export const CUT_FPS=25,MAX_CUT_FRAMES=12;
export function validateTransition(t){
 if(t===undefined)return;
 if(!t||Array.isArray(t)||typeof t!=='object'||Object.keys(t).sort().join(',')!=='frames,nextId'||typeof t.nextId!=='string'||!t.nextId||t.nextId.length>100||!Number.isInteger(t.frames)||Math.abs(t.frames)>MAX_CUT_FRAMES)throw Error('Kies een beeldverschuiving van maximaal 12 hele frames.');
}
export function cutLimits(a,b,duration){
 return {min:-Math.max(0,Math.min(MAX_CUT_FRAMES,Math.floor(a.frames/2),Math.floor(b.frames/2),Math.floor((b.sourceStart+1e-7)*CUT_FPS))),max:Math.max(0,Math.min(MAX_CUT_FRAMES,Math.floor(a.frames/2),Math.floor(b.frames/2),Math.floor((duration-a.sourceStart-a.frames/CUT_FPS+1e-7)*CUT_FPS)))};
}
export function transitionTarget(state,id,blockId){
 const m=state.modes[state.mode],blocks=m.blocks.filter(b=>b.clipIds.length),block=blocks.find(b=>b.id===blockId),ids=blockId==='teaser'?m.teaser:block?.clipIds,index=ids?.indexOf(id);
 if(index===undefined||index<0)return null;
 if(ids[index+1])return {kind:'clip',nextId:ids[index+1],index};
 const next=block&&blocks[blocks.indexOf(block)+1];
 return next?{kind:'topic',nextId:'topic:'+next.id,title:next.title,index}:null;
}
export function cardCutLimits(a,b,duration){
 return {min:-Math.min(MAX_CUT_FRAMES,Math.floor(a.frames/2),Math.floor(b.frames/2)),max:Math.max(0,Math.min(MAX_CUT_FRAMES,Math.floor(a.frames/2),Math.floor(b.frames/2),Math.floor((duration-a.sourceStart-a.frames/CUT_FPS+1e-7)*CUT_FPS)))};
}
export function applyVisualCuts(events,state,catalog){
 for(const e of events)if(e.kind==='clip')e.visualSegments=[{frames:e.frames,sourceStart:e.sourceStart,sourceEnd:e.sourceEnd,framing:e.framing}];
 const cuts=[];
 for(let i=0;i<events.length-1;i++){
  const a=events[i],b=events[i+1];if(a.kind!=='clip'||!['clip','topic'].includes(b.kind))continue;
  const topic=b.kind==='topic',nextId=topic?'topic:'+b.blockId:b.id;
  const t=state.modes[state.mode].edits?.[`${a.blockId}:${a.id}`]?.transition;
  const limits=(topic?cardCutLimits:cutLimits)(a,b,catalog.duration),requested=t?.nextId===nextId?t.frames:0;
  const frames=Math.max(limits.min,Math.min(limits.max,requested))||0;
  const cut={id:a.id,blockId:a.blockId,nextId,kind:b.kind,frames,requested,...limits};cuts.push(cut);
  if(topic){if(frames)b.pictureCut={frames};continue;}
  if(frames<0){
   const n=-frames,own=a.visualSegments.at(-1);own.frames-=n;
   a.visualSegments.push({frames:n,sourceStart:b.sourceStart-n/CUT_FPS,framing:b.framing});
  }else if(frames>0){
   b.visualSegments[0].frames-=frames;b.visualSegments[0].sourceStart+=frames/CUT_FPS;
   b.visualSegments.unshift({frames,sourceStart:a.sourceStart+a.frames/CUT_FPS,framing:a.framing});
  }
 }
 for(const e of events)if(e.kind==='clip')e.visualSegments=e.visualSegments.filter(s=>s.frames>0);
 return cuts;
}
