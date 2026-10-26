import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function git(args){const r=spawnSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:20*1024*1024});if(r.status!==0)throw Error('Git-controle mislukt: '+args[0]);return r.stdout.trim();}
try{
 const files=git(['ls-files']).split('\n').filter(Boolean);
 if(!files.length)throw Error('Geen vastgelegde softwarebestanden.');
 const forbidden=/(^|\/)(?:data|controle|node_modules|\.venv|\.runtime[^/]*)(\/|$)|(^|\/)(?:\.env(?:\.local)?|\.fmt-local\.json)$/;
 const sensitive=[/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/,/\bgh[pousr]_[A-Za-z0-9]{20,}/,/\bgithub_pat_[A-Za-z0-9_]{20,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bAKIA[A-Z0-9]{16}\b/];
 const retiredFontBlobs=new Set(["635f224c9b723af649510c7350071d4e96cbab85", "56d8a206e3fa149761830b2f056ddb577fae917c", "1300a376feaf6c593e55d78e5606d340d6ffc517"]);
 const stored=git(['cat-file','--batch-all-objects','--batch-check=%(objectname) %(objecttype)']).split('\n');
 if(stored.some(row=>retiredFontBlobs.has(row.split(' ')[0])))throw Error('Een verwijderd fontbestand zit nog in Git-objecten, ook buiten branches. Maak een nieuw schoon snapshot.');
 const objects=git(['rev-list','--objects','--all']).split('\n');
 let texts=0;
 for(const row of objects){
  const split=row.indexOf(' ');if(split<0)continue;
  const oid=row.slice(0,split),name=row.slice(split+1);if(/timeless.*\.ttf$/i.test(name))throw Error('Een niet-deelbaar fontbestand staat in de geschiedenis: '+name);if(forbidden.test(name))throw Error('Lokaal bestand in geschiedenis: '+name);
  if(git(['cat-file','-t',oid])!=='blob')continue;
  if(Number(git(['cat-file','-s',oid]))>10000000)continue;
  const r=spawnSync('git',['cat-file','-p',oid],{cwd:root,maxBuffer:12*1024*1024});
  if(r.stdout.subarray(0,8192).includes(0))continue;
  texts++;if(sensitive.some(p=>p.test(r.stdout.toString('utf8'))))throw Error('Mogelijk geheim in '+name+'; waarde wordt niet getoond.');
 }
 if(git(['remote']))throw Error('Deze lokale publicatiekandidaat hoort geen remote te hebben.');
 const title=fs.readFileSync(path.join(root,'README.md'),'utf8');
 if(!title.includes('publicatiekandidaat'))throw Error('Publicatiestatus ontbreekt.');
 for(const name of ['synthetic-editorial','synthetic-format','synthetic-full-format']){
  const f=JSON.parse(fs.readFileSync(path.join(root,'app/tests/fixtures',name+'.json')));
  if(f.synthetic!==true||f.transcriptHash)throw Error('Fixture is niet als fictief gemarkeerd: '+name);
 }
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json')));
 console.log(JSON.stringify({candidateChecksPassed:true,files:files.length,historyCommits:Number(git(['rev-list','--count','HEAD'])),textBlobsScanned:texts,remotes:0,publicationReady:false,reason:'Overige asset-/pakketvoorwaarden, schone installatie en expliciete publicatievrijgave blijven open.'},null,2));
 if(process.argv.includes('--release'))process.exitCode=2;
}catch(error){console.error(error.message);process.exitCode=1;}
