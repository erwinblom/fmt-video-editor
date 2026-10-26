import {importEngine,manualTranscript,runWhisper} from './basic-import.mjs';
import {command} from './runtime-config.mjs';
import {runSpeakers} from './recognize-speakers.mjs';
import {runDesert,vozTranscript} from './desert-ant.mjs';
import {runAnalysis} from './analyze-interview.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {writeJSON} from './interviews.mjs';
const dir=process.argv[2],metaFile=path.join(dir,'interview.json');
const run=(cmd,args)=>new Promise((resolve,reject)=>{const c=spawn(cmd,args,{stdio:['ignore','inherit','inherit']});c.on('error',reject);c.on('close',code=>code===0?resolve():reject(Error('Transcriptie kon niet worden voltooid. Controleer de opname en probeer opnieuw.')));});
let meta;
async function timed(name,fn){const start=Date.now();try{return await fn();}finally{const latest=JSON.parse(fs.readFileSync(metaFile,'utf8'));update(latest.message,{timings:{...latest.timings,[name]:Date.now()-start}});}}
function update(message,extra={}){meta={...JSON.parse(fs.readFileSync(metaFile,'utf8')),...extra,message};writeJSON(metaFile,meta);}
try{
 update('Audio voorbereiden',{status:'processing',pid:process.pid});
 const audio=path.join(dir,'transcriptie.wav'),out=path.join(dir,'transcript');
 await timed('audioPreparationMs',()=>run(command('ffmpeg'),['-v','error','-y','-i',path.join(dir,meta.sourceFile),'-vn','-ar','16000','-ac','1','-c:a','pcm_s16le',audio]));
 const directAudio=!meta.hasVideo&&['.mp3','.wav','.m4a','.ogg','.flac'].includes(path.extname(meta.sourceFile).toLowerCase());
 const previewFile=directAudio?meta.sourceFile:(meta.hasVideo?'preview.mp4':'preview.mp3');
 const preview=timed('previewMs',async()=>{if(!directAudio)await run(command('ffmpeg'),['-v','error','-y','-i',path.join(dir,meta.sourceFile),...(meta.hasVideo?['-map','0:v:0','-map','0:a:0','-vf','scale=1280:-2','-c:v','libx264','-preset','ultrafast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart']:['-vn','-c:a','libmp3lame','-b:a','160k']),path.join(dir,previewFile)]);update(meta.message,{previewFile});}).catch(e=>{update(meta.message,{previewError:e.message});});
 const engine=importEngine(meta.transcriptionEngine||'manual');
 update(engine==='manual'?'Bronfragmenten voorbereiden · zelf knippen en ondertitelen':engine==='whisper'?'Lokaal transcript met Whisper maken':'Letterlijk transcript met Voz maken');
 const raw=engine==='manual'?manualTranscript(meta.duration):await timed('transcriptionMs',()=>engine==='whisper'?runWhisper(audio,out,meta.language,meta.duration):runDesert('voz',audio,out+'.json',meta.language||'auto'));
 const language=raw.language||meta.language,subtitleLanguage=meta.subtitleLanguage||'nl';
 const {words,segments}=engine==='voz'?vozTranscript(raw,meta.duration):raw;
 if(!segments.length)throw Error('Geen spraak herkend. Je opname blijft bewaard; probeer opnieuw of kies een andere taal.');
 // Speaker and exact word alignment are unknown: keep those uncertainties explicit.
 const quotes={},blocks=[];let group=null;
 segments.forEach((s,i)=>{const id='q'+i;quotes[id]={id,speaker:'Spreker',...s,nl:'',review:engine==='manual'?'Werkfragment, geen transcript of goedgekeurde knip. Beluister en bepaal zelf begin, einde en ondertitels.':'Automatisch brontranscript. Controleer woorden, sprekers en zinsgrenzen tegen de audio.',translationStatus:'concept'};if(!group||s.start-group.start>=90){group={id:'b'+blocks.length,title:engine==='manual'?`Bron vanaf ${Math.floor(s.start/60)}:${String(Math.floor(s.start%60)).padStart(2,'0')}`:s.text.split(/\s+/).slice(0,9).join(' ').slice(0,110),reason:'Bronpassages in opnamevolgorde; nog geen thematische analyse of sprekerherkenning.',clipIds:[],start:s.start};blocks.push(group);}group.clipIds.push(id);});
 const catalogs=blocks.map(({start,...b})=>b),preset={x:0,y:0,width:meta.width,height:meta.height,contain:true};
 const catalog={version:1,title:meta.title,duration:meta.duration,source:'/bron.mp4',primarySpeaker:'Spreker',imported:true,details:{guest:meta.guest,interviewer:meta.interviewer,topic:meta.topic},language,sourceLanguage:language,subtitleLanguage,transcriptionEngine:raw.engine,manualEditing:engine==='manual',hasVideo:meta.hasVideo,quotes,transcript:segments.map(s=>({...s,speaker:'Spreker'})),words,teaserCandidates:Object.keys(quotes),catalog:{quoteverhaal:catalogs,gespreksmontage:catalogs},framing:{source:{width:meta.width,height:meta.height},image:{x:208,y:32,width:1504,height:846},caption:{x:200,y:916,width:1520,height:128},presets:{Spreker:{wide:preset,medium:preset,close:preset}}}};
 const mode=()=>({subtitleLanguage,subtitlesEnabled:engine!=='manual',selectionAngle:meta.direction||'',blocks:engine==='manual'?structuredClone(catalogs):[],teaser:[],edits:{}}),state={version:1,mode:'gespreksmontage',target:meta.target||300,revision:0,modes:{quoteverhaal:mode(),gespreksmontage:mode()}};
 fs.mkdirSync(path.join(dir,'data'),{recursive:true});writeJSON(path.join(dir,'data/catalog.json'),catalog);writeJSON(path.join(dir,'data/montages.json'),state);
 if(engine==='manual'){
  await preview;fs.rmSync(audio,{force:true});update('Klaar voor zelf monteren. Werkfragmenten van maximaal 30 seconden; bepaal zelf knippen en ondertitels.',{status:'ready',backgroundProcessing:false,pid:null,transcriptionEngine:'manual',finishedAt:Date.now()});
 }else{
 update('Transcript klaar · sprekers en onderwerpen worden op de achtergrond voorbereid',{status:'ready',backgroundProcessing:true,transcriptReadyAt:Date.now(),language,sourceLanguage:language,subtitleLanguage,transcriptionEngine:raw.engine,segmentCount:segments.length});
 writeJSON(path.join(dir,'data/analysis-status.json'),{id:'initial',status:'running',angle:meta.direction||'',pid:process.pid,message:'Wacht op sprekerherkenning'});
 let speakerError=null;try{if(engine==='voz')await timed('speakersMs',()=>runSpeakers(dir,message=>update(message)));}catch(e){speakerError=e.message;}
 let analysisError=null;try{await timed('analysisMs',()=>runAnalysis(dir,message=>update(message),meta.direction||''));}catch(e){analysisError=e.message;}
 await preview;fs.rmSync(audio,{force:true});
 update(analysisError?'Transcript klaar; thematische analyse vraagt aandacht.':'Klaar om te monteren',{status:'ready',backgroundProcessing:false,analysisError,speakerError,finishedAt:Date.now(),pid:null});
 }
}catch(e){try{update(e.message,{status:fs.existsSync(path.join(dir,'data/catalog.json'))?'ready':'failed',backgroundProcessing:false,pid:null});}catch{}console.error(e);process.exitCode=1;}
