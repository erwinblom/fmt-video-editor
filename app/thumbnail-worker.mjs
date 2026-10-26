import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import {requireLicenseNetworkConsent} from './license-network.mjs';
requireLicenseNetworkConsent();
const {Eye}=await import('@desert-ant-labs/eye/native');
import {command,projectRoot} from './runtime-config.mjs';
import {rankThumbnailFrames,writeThumbnailJSON} from './thumbnail-service.mjs';
const {source,crop,dir,key}=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const probe=JSON.parse(execFileSync(command('ffprobe'),['-v','error','-show_format','-show_streams','-of','json',source],{maxBuffer:2e6}));
const stream=probe.streams.find(s=>s.codec_type==='video'),duration=Number(probe.format.duration);
if(!stream||!Number.isFinite(duration)||duration<=0)throw Error('Geen bruikbare video.');
if(crop&&(!['x','y','width','height'].every(k=>Number.isInteger(crop[k]))||crop.x<0||crop.y<0||crop.width<=0||crop.height<=0||crop.x+crop.width>stream.width||crop.y+crop.height>stream.height))throw Error('Uitsnede past niet op de bronvideo.');
const filter=(crop?`crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},`:'')+'scale=1280:-2';
const eye=await Eye.load({cacheRoot:path.join(projectRoot,'.runtime-desert-ant','eye-models')});
const rows=[],total=Math.min(80,Math.max(1,Math.floor(duration/2)));
try{
 for(let i=0;i<total;i++){
  const seconds=duration*(i+.5)/total,id=String(i+1).padStart(3,'0'),file=path.join(dir,`${id}.jpg`);
  execFileSync(command('ffmpeg'),['-hide_banner','-loglevel','error','-ss',String(seconds),'-i',source,'-frames:v','1','-vf',filter,'-q:v','2','-y',file],{timeout:30000});
  const {data,info}=await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject:true});const a=await eye.analyze({data,width:info.width,height:info.height});
  rows.push({id,seconds,score:a.scores.cover,faceQuality:Math.max(0,...a.faces.map(f=>f.quality)),eyesClosed:a.has('eyes_closed'),blurry:a.has('blurry')});
  writeThumbnailJSON(path.join(dir,'status.json'),{key,status:'running',done:i+1,total});
 }
 const candidates=rankThumbnailFrames(rows,duration);writeThumbnailJSON(path.join(dir,'analysis.json'),rows);
 writeThumbnailJSON(path.join(dir,'status.json'),{key,status:'complete',done:total,total,candidates,message:candidates.length?'':'Geen scherp beeld met goed zichtbaar gezicht gevonden. Pas eventueel het gastkader aan.'});
 await eye.flushTelemetry();
}finally{eye.dispose();}
