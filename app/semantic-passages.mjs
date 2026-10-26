import {createHash} from 'node:crypto';
const keyWord=t=>t.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
// Model punctuation is only a boundary hint. Every displayed word stays from ASR.
function sentenceEnds(sentences,batch){
 if(!Array.isArray(sentences)||!sentences.length||sentences.some(s=>typeof s!=='string')||sentences.join(' ').length>16000)throw Error('Geen bruikbare zinsindeling.');
 sentences=sentences.flatMap(s=>s.split(/(?<=[.!?])\s+/)).filter(Boolean);
 const source=batch.map(w=>keyWord(w.text)),output=[];sentences.forEach((s,si)=>s.split(/\s+/).forEach(t=>{const word=keyWord(t);if(word)output.push({word,si});}));
 if(output.length>source.length*1.6)throw Error('Zinsindeling wijkt te veel van de bron af.');
 const n=source.length,m=output.length,dp=Array.from({length:n+1},()=>new Uint16Array(m+1));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=source[i]===output[j].word?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
 if(dp[0][0]<n*.85||dp[0][0]<m*.85)throw Error('De zinsindeling verandert te veel woorden. De brontekst blijft behouden.');
 const matched=new Map();let i=0,j=0;while(i<n&&j<m){if(source[i]===output[j].word){matched.set(j,i);i++;j++;}else if(dp[i+1][j]>=dp[i][j+1])i++;else j++;}
 const ends=[];for(let k=0;k<output.length;k++)if((k===output.length-1||output[k+1].si!==output[k].si)&&matched.has(k)&&!sentences[output[k].si].trim().endsWith('?')){const index=matched.get(k);if(!ends.length||index>ends.at(-1))ends.push(index);}return ends;
}
export async function semanticPassages(catalog,ask,progress,cache){
 ask=ask.sourceOrder||ask;
 if(catalog.preparedPassages?.length&&catalog.preparedPassagesVersion===2)return catalog;
 const punctuated=catalog.transcript.filter(s=>/[.!?]["'”’]*$/.test(s.text.trim())).length;
 if(!catalog.words?.length||punctuated>=Math.max(2,catalog.transcript.length*.03))return catalog;
 const words=catalog.words.filter(w=>w.speaker==='Spreker');if(!words.length)return catalog;
 const result=[];let cursor=0;
 while(cursor<words.length){const batch=words.slice(cursor,cursor+250),final=cursor+batch.length===words.length,key='sentences-'+createHash('sha256').update(JSON.stringify({version:3,batch,final})).digest('hex');progress(`Samenhangende bronpassages bepalen · ${Math.round(cursor/words.length*100)}%`);
  function check(sentences){let candidates=sentenceEnds(sentences,batch).filter(n=>final||n<batch.length-20);const ends=[];let first=0;for(const n of candidates)if(batch[n].end-batch[first].start>=6){ends.push(n);first=n+1;if(first>=batch.length)break;}if(final&&ends.at(-1)!==batch.length-1)ends.push(batch.length-1);if(!ends.length)throw Error('Geen complete gedachte in dit transcriptdeel gevonden.');return ends;}
  let ends;try{ends=check(cache.get(key));}catch{}
  if(!ends)for(let attempt=0;attempt<2;attempt++){try{const response=await ask(`Plaats natuurlijke zinsgrenzen in deze letterlijk herkende interviewspraak. Geef een JSON-object met sleutel sentences en een array van volledige, opeenvolgende zinnen. Behoud ALLE woorden en de volgorde, inclusief uh, herhaling en fout herkende namen. Voeg alleen leestekens toe. Niet samenvatten, verbeteren of vertalen. Zet een echte vraag als vraagzin met vraagteken. Geef geen woordnummers of uitleg. Bronspraak:\n${batch.map(w=>w.text).join('').trim()}`,2600);ends=check(response.sentences);cache.set(key,response.sentences);break;}catch(e){if(attempt)throw e;}}
  let first=0;for(const endIndex of ends){const slice=batch.slice(first,endIndex+1);if(!slice.length)continue;const from=cursor+first,to=cursor+endIndex,previous=words[from-1],next=words[to+1],start=Math.max(0,slice[0].start-.03,previous?(previous.end+slice[0].start)/2:0),end=Math.min(catalog.duration,slice.at(-1).end+.03,next?(slice.at(-1).end+next.start)/2:catalog.duration),text=slice.map(w=>w.text).join('').trim();if(end-start<.04)throw Error('Woordtijdcodes overlappen. Controleer de bron voordat je deze passage knipt.');const id='sp'+createHash('sha256').update(JSON.stringify({start,end,text})).digest('hex').slice(0,16);result.push({id,start,end,text,speaker:'Spreker',nl:!catalog.transcriptionEngine&&catalog.language==='nl'?text:'',sourceWords:{from,to},wordTimingApproximate:true});first=endIndex+1;}
  cursor+=ends.at(-1)+1;
 }
 if(!result.length)throw Error('Geen bewerkbare passages gevonden.');return {...catalog,preparedPassages:result,preparedPassagesVersion:2};
}
