import path from 'node:path';
import fs from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {command,projectRoot} from './runtime-config.mjs';
const run=promisify(execFile);
export const TRANSCRIPTION_ENGINES=['manual','whisper','voz'];
export function importEngine(input='manual'){if(!TRANSCRIPTION_ENGINES.includes(input))throw Error('Kies zelf monteren, Whisper of Voz.');return input;}
export function manualTranscript(duration){const segments=[];for(let start=0;start<duration;start+=30)segments.push({start,end:Math.min(duration,start+30),text:''});return {language:null,engine:'manual',words:[],segments};}
export function whisperTranscript(raw,duration){
 if(!Array.isArray(raw.transcription))throw Error('Whisper gaf geen bruikbaar transcript.');
 const segments=raw.transcription.map(s=>({start:Number(s.offsets?.from)/1000,end:Number(s.offsets?.to)/1000,text:String(s.text||'').trim()})).filter(s=>s.text&&Number.isFinite(s.start)&&Number.isFinite(s.end)&&s.start>=0&&s.end>s.start&&s.end<=duration+.2).map(s=>({...s,end:Math.min(duration,s.end)}));
 if(!segments.length)throw Error('Whisper herkende geen spraak. Je kunt ook Zelf monteren kiezen.');
 return {language:raw.result?.language||null,engine:'whisper.cpp',words:[],segments};
}
export async function runWhisper(audio,output,language,duration){
 const model=process.env.FMT_WHISPER_MODEL||path.join(projectRoot,'.runtime-models/whisper/ggml-small.bin');
 if(!fs.existsSync(model))throw Error('Whisper-model ontbreekt. Lees README.md voor lokale transcriptie, of kies Zelf monteren. Je opname blijft bewaard.');
 try{await run(process.env.FMT_WHISPER_BIN||command('whisper-cli'),['-m',model,'-f',audio,'-l',language||'auto','-oj','-of',output],{timeout:1800000,maxBuffer:4e6});}
 catch(e){throw Error(e.code==='ENOENT'?'Whisper is niet geïnstalleerd. Kies Zelf monteren of volg de Whisper-installatie in README.md.':'Whisper kon deze opname niet uitschrijven. Je opname blijft bewaard; probeer Zelf monteren.');}
 return whisperTranscript(JSON.parse(fs.readFileSync(output+'.json','utf8')),duration);
}
