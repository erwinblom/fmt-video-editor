import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {projectRoot,python,templateDir,command} from '../app/runtime-config.mjs';
const checks=[];
const extended=process.argv.includes('--all');
function check(label,ok,help,optional=false){checks.push({label,ok:!!ok,help,optional});}
const run=(cmd,args)=>spawnSync(cmd,args,{encoding:'utf8',timeout:15000});
check('Node.js 22.16 of nieuwer',Number(process.versions.node.split('.')[0])>22||(Number(process.versions.node.split('.')[0])===22&&Number(process.versions.node.split('.')[1])>=16),'Installeer een recente Node.js LTS-versie.');
for(const bin of ['git','ffmpeg','ffprobe'])check(bin,run(command(bin),[bin==='git'?'--version':'-version']).status===0,'Installeer '+bin+' op deze Mac.');
check('Python met Pillow en NumPy',run(python,['-c','import PIL,numpy']).status===0,'Voer Installeer FMT Video Editor.command uit.');
for(const file of ['template.json','assets/Inter-Regular.ttf','assets/Inter-Bold.ttf','assets/PaperMono-Regular.ttf','assets/interview-frame.png','assets/gsap.min.js'])check('Videotemplate: '+file,fs.existsSync(path.join(templateDir,file)),'Haal de complete softwareversie binnen.');
check('HyperFrames',fs.existsSync(process.env.FMT_HYPERFRAMES_CLI||path.join(projectRoot,'node_modules/hyperframes/bin/hyperframes.mjs')),'Voer npm ci uit.');
if(extended){
 check('Optioneel: Voz / Who voor automatisch uitschrijven en stemmen',fs.existsSync(path.join(projectRoot,'.runtime-desert-ant/build/release/FMTTranscribe')),'Lees MODELVOORWAARDEN.md vóór de aparte installatie; dit onderdeel vraagt licentienetwerk.',true);
 const analysis=process.env.FMT_ANALYSIS_MODEL||path.join(projectRoot,'.runtime-models/analysis/gemma-4-E4B-it-Q4_K_M.gguf');
 check('Optioneel: lokaal analysemodel en llama-server',!!analysis&&fs.existsSync(analysis)&&run(command('llama-server'),['--version']).status===0,'Kies bewust een lokaal model en stel FMT_ANALYSIS_MODEL en zo nodig FMT_LLAMA_SERVER_BIN in.',true);
 const whisperModel=process.env.FMT_WHISPER_MODEL||path.join(projectRoot,'.runtime-models/whisper/ggml-small.bin');
 check('Optioneel: Whisper voor transcriptie en audiocontrole',run(process.env.FMT_WHISPER_BIN||command('whisper-cli'),['--help']).status===0&&fs.existsSync(whisperModel),'Handmatige broncontrole en de demo vragen geen Whisper; automatische controle vraagt een apart model.',true);
 let keyPresent=!!process.env.OPENAI_API_KEY;try{keyPresent ||= /^OPENAI_API_KEY\s*=\s*\S+/m.test(fs.readFileSync(path.join(projectRoot,'.env.local'),'utf8'));}catch{}
 check('Optioneel: eigen OpenAI-instelling',keyPresent,'Alleen voor expliciet gekozen cloudfuncties, in .env.local.',true);
 check('Optioneel: Auphonic CLI',run(process.env.AUPHONIC_CLI||path.join(os.homedir(),'.local/bin/auphonic'),['--help']).status===0,'Lokale export vraagt geen Auphonic. Een CLI bewijst geen login of tegoed.',true);
}
for(const c of checks)console.log(`${c.ok?'✓':'○'} ${c.label}${c.ok?'':' — '+c.help}`);
console.log('\nVideo’s, montages en transcripties staan alleen in app/data van deze kopie.');
if(!extended)console.log('Aanvullende spraak-, analyse- en cloudfuncties: node scripts/check-installation.mjs --all. Die zijn niet nodig voor de stille demo en handmatig gecontroleerde lokale export.');
if(checks.some(c=>!c.ok&&!c.optional))process.exitCode=1;
