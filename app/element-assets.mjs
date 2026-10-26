import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {assetId} from './public/elements.mjs';
export function elementAssets(root){
 const dir=path.join(root,'data/element-assets');
 function file(id){if(!assetId(id))throw Error('Onbekend elementbeeld');return path.join(dir,id+'.png');}
 function put(bytes){
  if(bytes.length<33||bytes.length>5*1024*1024||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.toString('ascii',12,16)!=='IHDR'||bytes.toString('ascii',bytes.length-8,bytes.length-4)!=='IEND')throw Error('Gebruik een PNG-afbeelding van maximaal 5 MB');
  const w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);if(!w||!h||w>4096||h>4096)throw Error('Afbeelding is te groot');
  const id=createHash('sha256').update(bytes).digest('hex');fs.mkdirSync(dir,{recursive:true});if(!fs.existsSync(file(id)))fs.writeFileSync(file(id),bytes,{flag:'wx'});return {id};
 }
 function snapshot(id,destination){const bytes=fs.readFileSync(file(id));if(createHash('sha256').update(bytes).digest('hex')!==id)throw Error('Elementbeeld is gewijzigd');fs.writeFileSync(destination,bytes);}
 return {file,put,snapshot};
}
