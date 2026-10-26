import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
try {
  const files=fs.readFileSync(path.join(root,'release-files.txt'),'utf8').trim().split('\n');
  if(new Set(files).size!==files.length)throw Error('Dubbele paden in bestandslijst.');
  const sums=new Map(fs.readFileSync(path.join(root,'SOURCE-SHA256SUMS.txt'),'utf8').trim().split('\n').map(line=>{
    const match=/^([a-f0-9]{64})  (.+)$/.exec(line);
    if(!match)throw Error('Ongeldig bronhashbestand.');
    return [match[2],match[1]];
  }));
  const forbidden=/(^|\/)(?:data|controle|node_modules|\.git|\.venv|\.runtime[^/]*)(\/|$)|(^|\/)(?:\.env(?:\.local)?|\.fmt-local\.json)$|\.(?:mp4|mov|mp3|wav|gguf|onnx)$/i;
  const secrets=[/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/,/\bgh[pousr]_[A-Za-z0-9]{20,}/,/\bgithub_pat_[A-Za-z0-9_]{20,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bAKIA[A-Z0-9]{16}\b/];
  for(const name of files){
    if(path.isAbsolute(name)||name.split('/').includes('..')||forbidden.test(name))throw Error('Onveilig pakketpad: '+name);
    const filename=path.join(root,name);
    if(!fs.lstatSync(filename).isFile())throw Error('Geen gewoon bronbestand: '+name);
    const bytes=fs.readFileSync(filename);
    if(name!=='SOURCE-SHA256SUMS.txt'&&crypto.createHash('sha256').update(bytes).digest('hex')!==sums.get(name))throw Error('Bronbestand ontbreekt of wijkt af: '+name);
    if(!bytes.subarray(0,8192).includes(0)&&secrets.some(pattern=>pattern.test(bytes.toString('utf8'))))throw Error('Mogelijk geheim in '+name+'; waarde wordt niet getoond.');
  }
  if(sums.size!==files.length-1||[...sums.keys()].some(name=>!files.includes(name)))throw Error('Hashlijst en bestandslijst verschillen.');
  console.log(JSON.stringify({sourcePackagePassed:true,files:files.length,hashedFiles:sums.size,scope:'Bronbestanden; geen garantie voor installatie, modelkwaliteit of rechten op latere runtimebundels.'},null,2));
}catch(error){console.error(error.message);process.exitCode=1;}
