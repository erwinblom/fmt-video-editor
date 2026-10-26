import {command} from './runtime-config.mjs';
import {runDesert} from './desert-ant.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {writeJSON} from './interviews.mjs';
const appRoot=path.dirname(fileURLToPath(import.meta.url));
export async function runSpeakers(dir,notify=()=>{}){
 const file=path.join(dir,'data/speakers.json'),meta=JSON.parse(fs.readFileSync(path.join(dir,'interview.json'))),audio=path.join(dir,'speaker-audio.wav'),output=path.join(dir,'speaker-turns.tmp.json');let job=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{revision:0,count:meta.speakerCount??2};
 const update=(message,extra={})=>{job={...job,status:'running',pid:process.pid,message,...extra};writeJSON(file,job);notify(message);};
 const run=(cmd,args,progress=false)=>new Promise((resolve,reject)=>{const c=spawn(cmd,args,{stdio:['ignore','pipe','pipe']});let err='';c.stdout.on('data',b=>{if(progress){const m=b.toString().match(/PROGRESS (\d+)/);if(m)update(`Stemmen lokaal onderscheiden · ${m[1]}%`);}});c.stderr.on('data',b=>{err=(err+b).slice(-3000);});c.on('error',reject);c.on('close',n=>n===0?resolve():reject(Error('Lokale sprekerherkenning mislukt. '+err.slice(-300))));});
 try{update('Audio voorbereiden voor sprekerherkenning');await run(command('ffmpeg'),['-v','error','-y','-i',path.join(dir,meta.sourceFile),'-vn','-ar','16000','-ac','1','-c:a','pcm_s16le',audio]);update('Stemmen met Who onderscheiden');const result=await runDesert('who',audio,output);
 const raw=result.turns;if(!Array.isArray(raw)||!raw.length||raw.some(t=>!Number.isFinite(t.start)||!Number.isFinite(t.end)||t.end<=t.start||t.start<0||t.end>meta.duration+.2||!/^voice\d+$/.test(t.speakerId)))throw Error('Geen bruikbare spreekbeurten herkend.');
 const ids=[...new Set(raw.map(t=>t.speakerId))],voices=ids.map((id,i)=>{const spans=raw.filter(t=>t.speakerId===id).sort((a,b)=>(b.end-b.start)-(a.end-a.start)),sample=spans.find(t=>!raw.some(o=>o.speakerId!==id&&o.start<t.end&&o.end>t.start))||spans[0];return {id,label:`Stem ${i+1}`,name:'',role:'unknown',sample:{start:sample.start,end:Math.min(sample.end,sample.start+8)}};});
 update(`${voices.length} stemmen gevonden. Luister en kies wie wie is.`,{status:'complete',pid:null,voices,turns:raw.map((t,i)=>({...t,id:'turn'+i,detectedSpeakerId:t.speakerId})),engine:result.engine,finishedAt:Date.now(),revision:job.revision+1});if(meta.status==='ready')writeJSON(path.join(dir,'interview.json'),{...meta,speakerError:null});return job;
 }catch(e){update(e.message,{status:'failed',pid:null});throw e;}finally{fs.rmSync(audio,{force:true});fs.rmSync(output,{force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)runSpeakers(process.argv[2]).catch(e=>{console.error(e);process.exitCode=1;});
