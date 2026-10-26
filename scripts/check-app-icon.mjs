import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'app/public');
const hashes=JSON.parse(fs.readFileSync(path.join(dir,'app-icon-hashes.json')));
for(const [name,hash] of Object.entries(hashes)){
 const actual=createHash('sha256').update(fs.readFileSync(path.join(dir,name))).digest('hex');
 if(actual!==hash)throw Error('FMT-appicoon gewijzigd of ontbreekt: '+name);
}
for(const name of ['index.html','welcome.html','licenses.html']){
 const html=fs.readFileSync(path.join(dir,name),'utf8');
 if(!html.includes('href="/app.webmanifest"')||!html.includes('href="/app-icon.svg"'))throw Error('Appicoonverwijzing ontbreekt in '+name);
}
console.log('FMT-appiconen en browsermanifest gecontroleerd.');
