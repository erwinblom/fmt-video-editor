// Desert Ant Labs (Voz / Who / SDK): https://license.desertant.com
// Powered by Desert Ant Labs: https://desertant.com — separate from our MIT code.
import {requireLicenseNetworkConsent} from './license-network.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const runtime=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../.runtime-desert-ant');
async function runNative(mode,audio,output,language='auto'){
 const binary=path.join(runtime,'build/release/FMTTranscribe');
 if(!fs.existsSync(binary))throw Error('Voz en Who zijn nog niet voorbereid. Start scripts/setup-desert-ant.sh. Je opname blijft bewaard.');
 return new Promise((resolve,reject)=>{
  const child=spawn(binary,[mode,audio,output,path.join(runtime,'models'),language],{stdio:['ignore','ignore','pipe']});let error='';
  const timer=setTimeout(()=>child.kill('SIGTERM'),15*60*1000);timer.unref();
  child.stderr.on('data',b=>{error=(error+b).slice(-3000);});child.on('error',e=>{clearTimeout(timer);reject(e);});
  child.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(Error('Lokale '+(mode==='voz'?'transcriptie':'sprekerherkenning')+' mislukt. '+error.slice(-700)));try{resolve(JSON.parse(fs.readFileSync(output,'utf8')));}catch{reject(Error('Geen bruikbare uitvoer van '+mode+'. Je bron is bewaard.'));}});
 });
}
export function isVozCoreMLCompatibilityError(error){
 return /multi-function description (?:syntax|sytnax)|functionName.*must be.*nil.*ML Program/i.test(error.message);
}
export async function runDesert(mode,audio,output,language='auto'){
 requireLicenseNetworkConsent();
 try{return await runNative(mode,audio,output,language);}
 catch(error){
  if(mode!=='voz'||!isVozCoreMLCompatibilityError(error))throw error;
  return new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,[path.join(path.dirname(fileURLToPath(import.meta.url)),'voz-node.mjs'),audio,output,language],{stdio:['ignore','ignore','pipe']});let detail='';
   const timer=setTimeout(()=>child.kill('SIGTERM'),15*60*1000);timer.unref();
   child.stderr.on('data',b=>{detail=(detail+b).slice(-1500);});
   child.on('error',e=>{clearTimeout(timer);reject(e);});
   child.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(Error('Lokale Voz-compatibiliteitsroute mislukt. '+detail.slice(-700)));try{resolve(JSON.parse(fs.readFileSync(output,'utf8')));}catch{reject(Error('Geen bruikbare Voz-uitvoer. Je bron is bewaard.'));}});
  });
 }
}
// Prefixes preserve the editor's literal-word concatenation convention.
export function vozTranscript(raw,duration){
 if(!Array.isArray(raw.words)||!raw.words.length)throw Error('Geen spraak herkend.');
 const words=raw.words.map(w=>{
  if(typeof w.text!=='string'||!w.text.trim()||!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.start<0||w.end<w.start||w.start>=duration||w.end>duration+.2)throw Error('Ongeldige Voz-woordtijdcode.');
  return {text:' '+w.text.trim(),start:w.start,end:Math.min(duration,Math.max(w.start+.01,w.end)),speaker:'Spreker',approximate:true};
 });
 if(words.some((w,i)=>i>0&&w.start<words[i-1].start))throw Error('Voz-woorden staan niet in bronvolgorde.');
 const segments=[];let group=[];
 const finish=()=>{if(!group.length)return;segments.push({start:group[0].start,end:group.at(-1).end,text:group.map(w=>w.text).join('').trim()});group=[];};
 for(const w of words){group.push(w);if(/[.!?]["'”’]*$/.test(w.text.trim())||w.end-group[0].start>=30)finish();}finish();
 return {words,segments};
}
