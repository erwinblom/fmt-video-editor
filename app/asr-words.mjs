// Whisper token offsets are approximate source timings, never invented transcript text.
export function whisperWords(raw,duration){
 const words=[];
 for(const segment of raw.transcription||[]){let word=null;
  const finish=()=>{if(word?.text.trim()&&word.start<duration){word.end=Math.min(duration,Math.max(word.end,word.start));words.push(word);}word=null;};
  for(const token of segment.tokens||[]){if(!token.text||/^\[.*\]$/.test(token.text.trim())||!Number.isFinite(token.offsets?.from)||token.offsets.from<0)continue;const start=Math.max(0,token.offsets.from/1000),end=Math.max(start,token.offsets.to/1000);if(/^\s/.test(token.text))finish();if(!word)word={text:token.text,start,end,speaker:'Spreker',approximate:true};else{word.text+=token.text;word.end=Math.max(word.end,end);}}
  finish();
 }
 return words.map((w,i)=>({...w,end:Math.min(duration,w.end>w.start?w.end:Math.max(w.start+.01,words[i+1]?.start||w.start+.01))})).filter(w=>w.end>w.start);
}
