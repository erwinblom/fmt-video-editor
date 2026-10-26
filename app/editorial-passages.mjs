import {createHash} from 'node:crypto';
import {editorialPrompt,editorialRules} from './editorial-rules.mjs';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export const isProductionText=text=>/\b(?:don't|do not)\s+(?:stress|worry)\s+about\s+(?:the\s+)?time\b|\b(?:hoeveel tijd hebben we|haast je niet|opname stoppen|send it to your|send (?:you|it) (?:the |a )?(?:recording|article)|arrange that.{0,30}speak soon)\b/i.test(text);
export async function classifySource(catalog,ask,progress,cache){
 ask=ask.sourceOrder||ask;const rows=catalog.preparedPassages?.length?catalog.preparedPassages:catalog.transcript,labels=[];
 for(let i=0;i<rows.length;i+=24){const batch=rows.slice(i,i+24),input=batch.map((s,j)=>({id:'S'+j,text:s.text})),key='source-kinds-'+hash({version:1,rules:editorialRules().hash,input});
 const check=r=>{if(!Array.isArray(r?.segments)||r.segments.length!==batch.length)throw Error('Onvolledige bronclassificatie.');const seen=new Set();for(const s of r.segments){if(!/^S\d+$/.test(s.id)||!batch[Number(s.id.slice(1))]||seen.has(s.id)||!['antwoord','vraag','instemming','regie','nazorg'].includes(s.kind))throw Error('Ongeldige bronclassificatie.');seen.add(s.id);}return input.map(s=>r.segments.find(t=>t.id===s.id).kind);};
 progress(`Regie en nazorg onderscheiden · ${i+1}/${rows.length}`);let kinds;try{kinds=check(cache.get?.(key));}catch{}
 if(!kinds)for(let attempt=0;attempt<2;attempt++){try{const r=await ask(`${editorialPrompt('source-kinds')} Geef elk S-ID exact eenmaal. JSON: {"segments":[{"id":"S0","kind":"antwoord"}]}. Vooraf: ${rows.slice(Math.max(0,i-2),i).map(s=>s.text).join(' ')}. Bron: ${JSON.stringify(input)}. Daarna: ${rows.slice(i+batch.length,i+batch.length+2).map(s=>s.text).join(' ')}`,2200,{type:'object',properties:{segments:{type:'array',minItems:batch.length,maxItems:batch.length,items:{type:'object',properties:{id:{type:'string',enum:input.map(s=>s.id)},kind:{type:'string',enum:['antwoord','vraag','instemming','regie','nazorg']}},required:['id','kind'],additionalProperties:false}}},required:['segments'],additionalProperties:false});kinds=check(r);cache.set?.(key,r);break;}catch(e){if(attempt)throw e;}}
 labels.push(...kinds.map((kind,j)=>isProductionText(batch[j].text)?'regie':kind));
 }return markAfterClosing(rows,catalog.duration,labels);
}
export const isAcknowledgement=text=>/^(?:(?:yeah|yes|yep|okay|ok|absolutely|exactly|right|sure|ja|precies|inderdaad|uh|um|ah)[\s,.!?-]*)+$/i.test(text.trim());
export function markAfterClosing(rows,duration,labels){const closing=rows.findIndex(r=>r.start>duration*.9&&/(?:thank you very much|hartelijk bedankt)/i.test(r.text)&&/(?:good luck|nice to meet|speak again|tot ziens)/i.test(r.text));
 return rows.map((r,i)=>({...r,kind:closing>=0&&i>=closing?'nazorg':isAcknowledgement(r.text)?'instemming':labels[i]}));
}
export function makePassage(rows){const start=rows[0].start,end=rows.at(-1).end,text=rows.map(s=>s.text.trim()).join(' ');return {id:'sp'+hash({start,end,text}).slice(0,16),start,end,text,nl:'',speaker:'Spreker',sourceSegments:rows.map(s=>({start:s.start,end:s.end})),segments:rows,excluded:rows.every(s=>['regie','nazorg','instemming'].includes(s.kind))};}
export function refinePassages(groups,source){
 const out=[];
 for(const g of groups){const rows=source.filter(s=>s.start>=g.start-.001&&s.end<=g.end+.001);let part=[];
 const flush=()=>{if(part.length)out.push(makePassage(part));part=[];};
 for(const s of rows){if(['regie','nazorg'].includes(s.kind)){flush();out.push(makePassage([s]));continue;}if(s.kind==='vraag'&&part.some(r=>r.kind==='antwoord'))flush();part.push(s);}flush();}
 // A trailing question moves forward, while excluded production chatter is never reattached.
 for(let i=0;i<out.length-1;i++){if(!out[i].excluded&&!out[i+1].excluded&&out[i].segments.some(s=>s.kind==='vraag')&&!out[i].segments.some(s=>s.kind==='antwoord')){out.splice(i,2,makePassage([...out[i].segments,...out[i+1].segments]));i--;}}
 if(out.map(p=>p.text).join(' ')!==source.map(s=>s.text.trim()).join(' '))throw Error('De redactionele indeling verliest bronwoorden.');return out;
}
export async function deriveQuoteUnits(result,source,ask,progress,cache){
 ask=ask.sourceOrder||ask;
 const candidates=[];
 for(const parent of result.bank.units){if(parent.eligible===false)continue;const q=result.catalog.quotes[parent.id];let part=[];
 const flush=()=>{if(!part.length)return;const p=makePassage(part);part=[];if(p.end-p.start>=6)candidates.push({...p,id:'sq'+hash({start:p.start,end:p.end,text:p.text}).slice(0,16),parent});};
 for(const s of q.segments||[]){if(s.kind!=='antwoord'){flush();continue;}part.push(s);}flush();}
 const accepted=[];
 for(let i=0;i<candidates.length;i+=10){const batch=candidates.slice(i,i+10),input=batch.map((q,j)=>({id:'Q'+j,text:q.text,contextVoor:source.transcript.filter(s=>s.end<=q.start+.001).slice(-2).map(s=>s.text).join(' '),contextNa:source.transcript.filter(s=>s.start>=q.end-.001).slice(0,2).map(s=>s.text).join(' ')})),key='independent-quotes-'+hash({version:1,rules:editorialRules().hash,input});
 const check=value=>{const r=value?.quotes&&!Array.isArray(value.quotes)?{quotes:Object.entries(value.quotes).map(([id,q])=>({...q,id}))}:value;if(!Array.isArray(r?.quotes)||r.quotes.length!==batch.length)throw Error('Onvolledige quotecontrole.');const seen=new Set();for(const q of r.quotes){if(!/^Q\d+$/.test(q.id)||!batch[Number(q.id.slice(1))]||seen.has(q.id)||typeof q.standalone!=='boolean'||!Number.isInteger(q.score)||q.score<0||q.score>100)throw Error('Ongeldige quotecontrole.');seen.add(q.id);}return r.quotes;};let reviewed;try{reviewed=check(cache.get?.(key));}catch{}
 progress('Zelfstandige quotes uit antwoorden halen');if(!reviewed)for(let attempt=0;attempt<2;attempt++){try{const r=await ask(`${editorialPrompt('quote-extract')} JSON: {"quotes":{"Q0":{"standalone":true,"score":85}}}. Alle Q-IDs eenmaal. Bron: ${JSON.stringify(input)}`,1600,{type:'object',properties:{quotes:{type:'object',properties:Object.fromEntries(input.map(s=>[s.id,{type:'object',properties:{standalone:{type:'boolean'},score:{type:'integer',minimum:0,maximum:100}},required:['standalone','score'],additionalProperties:false}])),required:input.map(s=>s.id),additionalProperties:false}},required:['quotes'],additionalProperties:false});reviewed=check(r);cache.set?.(key,r);break;}catch(e){if(attempt)throw e;}}
 for(const review of reviewed){if(!review.standalone||review.score<70)continue;const q=batch[Number(review.id.slice(1))];if(isProductionText(q.text)||/it depends on what you mean|that was very vague|dat hangt af van wat je bedoelt/i.test(q.text))continue;const {parent,...quote}=q;result.catalog.quotes[q.id]={...quote,translationStatus:'concept',review:'Zelfstandige bronquote; controleer spreker en zinsgrenzen.'};accepted.push({...parent,id:q.id,parentId:parent.id,standalone:true,priority:review.score,clips:[{quoteId:q.id,conversationId:parent.id,start:q.start,end:q.end,text:q.text,nl:''}]});}
 }
 result.bank.quoteUnits=accepted;
 result.catalog.catalog.quoteverhaal=result.catalog.catalog.gespreksmontage.map(b=>({...b,clipIds:accepted.filter(q=>q.blockId===b.id).map(q=>q.id)})).filter(b=>b.clipIds.length);
 return result;
}
