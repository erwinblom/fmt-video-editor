import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {readStyle,validateStyle} from './own-style.mjs';
import {requireLicenseNetworkConsent} from './license-network.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {command} from './runtime-config.mjs';
const run=promisify(execFile);
const running=new Map();
const worker=fileURLToPath(new URL('./thumbnail-worker.mjs',import.meta.url));

const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
export function writeThumbnailJSON(p,value){const temp=p+'.'+randomUUID();fs.writeFileSync(temp,JSON.stringify(value,null,2));fs.renameSync(temp,p);}
export const thumbnailRunning=root=>running.has(root);
export function thumbnailKey(source,crop){const s=fs.statSync(source);return createHash('sha256').update(JSON.stringify({version:1,source,size:s.size,mtime:s.mtimeMs,crop})).digest('hex');}
export function rankThumbnailFrames(rows,duration){
 const sorted=rows.filter(r=>!r.eyesClosed&&!r.blurry&&r.faceQuality>=.75).sort((a,b)=>b.score-a.score);
 const chosen=[];for(const row of sorted){if(chosen.every(r=>Math.abs(r.seconds-row.seconds)>=Math.min(60,duration/8)))chosen.push(row);if(chosen.length===3)break;}return chosen;
}
export function thumbnailTitle(value){if(typeof value!=='string'||!value.trim()||[...value.trim()].length>70||/[\x00-\x1f]/.test(value))throw Error('Gebruik een titel van 1 tot 70 tekens, zonder regeleinden.');return value.trim();}
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export async function renderThumbnail(input,title,ownStyle={}){
 const style=validateStyle(ownStyle);
 title=thumbnailTitle(title);
 const text=await sharp({text:{text:`<span foreground="white">${escape(title)}</span>`,font:'sans bold',width:1100,height:150,rgba:true}}).png().toBuffer();
 const overlays=[];if(style.logo){const mark=await sharp(Buffer.from(style.logo.split(',')[1],'base64')).resize(100,100,{fit:'contain',background:'#ffffff00'}).png().toBuffer();overlays.push({input:mark,left:1150,top:28});}
 const panel=Buffer.from('<svg width="1280" height="720"><rect y="490" width="1280" height="230" fill="#0a0a0a"/><rect y="490" width="1280" height="8" fill="#e10600"/></svg>');
 return sharp(input).resize(1280,490,{fit:'contain',background:'#f2f0eb'}).extend({bottom:230,background:'#0a0a0a'}).composite([{input:panel},...overlays,{input:text,left:64,top:535}]).jpeg({quality:90,mozjpeg:true}).toBuffer();
}
export function thumbnailService(root,source,stateFile,metadata={},appRoot=root){
 const base=path.join(root,'data/thumbnails');
 function styleHash(){return createHash('sha256').update(JSON.stringify(readStyle(appRoot))).digest('hex');}
 function context(){if(metadata.hasVideo===false)throw Error('Thumbnails zijn beschikbaar bij video-interviews.');const state=read(stateFile);const crop=state.guestFrames?.wide||state.guestCrop||null;const key=thumbnailKey(source,crop);return {key,crop,dir:path.join(base,key)};}
 function status(){const c=context(),p=path.join(c.dir,'status.json');if(!fs.existsSync(p))return {key:c.key,status:'empty'};const s=read(p);if(s.status==='running'&&!running.has(root))return {...s,status:'interrupted',error:'Het maken is onderbroken. Probeer opnieuw.'};const choice=path.join(c.dir,'choice.json');return {...s,...(fs.existsSync(choice)?{choice:{...read(choice),styleChanged:read(choice).styleHash!==styleHash()}}:{})};}
 function start(){requireLicenseNetworkConsent();const c=context(),current=status();if(running.has(root)){if(current.status==='running')return current;throw Error('Voor dit interview worden nog beelden gemaakt. Wacht tot die ronde klaar is.');}if(current.status==='complete')return current;fs.mkdirSync(c.dir,{recursive:true});const spec=path.join(c.dir,'request.json');writeThumbnailJSON(spec,{source,crop:c.crop,dir:c.dir,key:c.key});writeThumbnailJSON(path.join(c.dir,'status.json'),{key:c.key,status:'running',done:0,total:80});const child=spawn(process.execPath,[worker,spec],{stdio:['ignore','ignore','pipe']});running.set(root,child);let error='';child.stderr.on('data',d=>{error=(error+d).slice(-2000);});const finish=code=>{running.delete(root);if(code!==0)writeThumbnailJSON(path.join(c.dir,'status.json'),{key:c.key,status:'error',error:'Beeldselectie mislukt. Probeer opnieuw.',detail:error});};child.once('error',e=>{error=e.message;finish(1);});child.once('exit',finish);return status();}
 function currentKey(key){const c=context();if(c.key!==key)throw Error('De bron of uitsnede is gewijzigd. Maak opnieuw beeldvoorstellen.');return c;}
 function image(key,id){const c=currentKey(key);const s=status();if(s.status!=='complete'||!s.candidates?.some(x=>x.id===id))throw Error('Onbekend beeldvoorstel.');return path.join(c.dir,`${id}.jpg`);}
 async function save(input){const title=thumbnailTitle(input.title),c=currentKey(input.key),photo=image(input.key,input.id);const bytes=await renderThumbnail(photo,title,readStyle(appRoot));currentKey(input.key);const output=createHash('sha256').update(bytes).digest('hex');fs.writeFileSync(path.join(c.dir,`${output}.jpg`),bytes);writeThumbnailJSON(path.join(c.dir,'choice.json'),{id:input.id,title,output,styleHash:styleHash(),savedAt:new Date().toISOString()});return status();}
 function download(key,output){const c=currentKey(key);if(!/^[a-f0-9]{64}$/.test(output)||!fs.existsSync(path.join(c.dir,`${output}.jpg`)))throw Error('Thumbnail niet gevonden.');return path.join(c.dir,`${output}.jpg`);}
 async function frame(input){
  const c=context();if(running.has(root))throw Error('Wacht tot de beeldselectie klaar is.');
  const seconds=Number(input.seconds);if(!Number.isFinite(seconds)||seconds<0)throw Error('Kies een geldig tijdstip in seconden.');
  const {stdout}=await run(command('ffprobe'),['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',source]);if(seconds>=Number(stdout))throw Error('Dit tijdstip ligt buiten de opname.');
  fs.mkdirSync(c.dir,{recursive:true});const id='m'+Math.round(seconds*1000),target=path.join(c.dir,id+'.jpg');
  const filter=(c.crop?`crop=${c.crop.width}:${c.crop.height}:${c.crop.x}:${c.crop.y},`:'')+'scale=1280:-2';
  await run(command('ffmpeg'),['-hide_banner','-loglevel','error','-ss',String(seconds),'-i',source,'-frames:v','1','-vf',filter,'-q:v','2','-y',target],{timeout:30000});
  currentKey(c.key);const old=status();const candidates=[{id,seconds,manual:true},...(old.candidates||[]).filter(x=>x.id!==id)].slice(0,4);
  writeThumbnailJSON(path.join(c.dir,'status.json'),{key:c.key,status:'complete',candidates,message:'Handmatig gekozen bronbeeld.'});return {...status(),selectedId:id};
 }
 return {status,start,image,save,download,frame};
}
