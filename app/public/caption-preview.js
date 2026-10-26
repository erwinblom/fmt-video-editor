import {projectFetch} from './interviews.js';
export function initCaptionPreview(context){
 const node=document.querySelector('#captionPreview'),video=document.querySelector('#video'),cache=new Map();let currentKey=null,cues=[],ticket=0;
 function paint(){const q=context();if(!q)return;const t=video.currentTime-q.quote.start,c=cues.find(c=>t>=c.start&&t<c.end);node.textContent=c?c.lines.join('\n'):'';}
 async function update(){const ctx=context();if(!ctx){currentKey=null;cues=[];node.textContent='';return;}
  const {quote:q,...ref}=ctx,key=JSON.stringify({...ref,start:q.start,end:q.end,nl:q.nl||''});
  if(key===currentKey){paint();return;}currentKey=key;cues=[];paint();const generation=++ticket;
  try{if(!cache.has(key)){const response=await projectFetch('/api/preview-captions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...ref,start:q.start,end:q.end,nl:q.nl||''})});const data=await response.json();if(!response.ok)throw Error(data.error);cache.set(key,data);if(cache.size>100)cache.delete(cache.keys().next().value);}if(ticket!==generation)return;cues=cache.get(key);node.title='Dezelfde ondertitelgroepen als de export';paint();}catch{if(ticket===generation)node.title='Ondertitelpreview niet beschikbaar';}
 }
 for(const event of ['timeupdate','seeked'])video.addEventListener(event,paint);
 function frame(){paint();if(video.requestVideoFrameCallback)video.requestVideoFrameCallback(frame);}if(video.requestVideoFrameCallback)video.requestVideoFrameCallback(frame);
 return {update};
}
