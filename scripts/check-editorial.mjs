import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {reviewTeasers} from '../app/thematic-analysis.mjs';
import {withLocalModel} from '../app/local-analysis-model.mjs';
import {withEditorialRules,editorialRules} from '../app/editorial-rules.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixture=JSON.parse(fs.readFileSync(path.join(root,'app/tests/fixtures/synthetic-editorial.json'),'utf8'));
const out=path.resolve(process.argv[2]||path.join(root,'controle/redactionele-proef',new Date().toISOString().replace(/[:.]/g,'-')));fs.mkdirSync(out,{recursive:true});
const started=performance.now();
const selected=fixture.cases.map(q=>({quote:q,score:80}));
try{
 const accepted=await withLocalModel(out,ask=>reviewTeasers(selected,fixture,withEditorialRules(ask),console.log,new Map()));
 const ids=new Set(accepted.map(r=>r.quote.id));
 const cases=fixture.cases.map(q=>({id:q.id,start:q.start,end:q.end,text:q.text,expected:q.expectedAccept,actual:ids.has(q.id),pass:ids.has(q.id)===q.expectedAccept,reason:q.reason}));
 const report={rules:editorialRules(),model:'gemma-4-E4B-it-Q4_K_M',seconds:(performance.now()-started)/1000,passed:cases.every(c=>c.pass),cases,accepted:accepted.map(r=>({id:r.quote.id,score:r.score,reason:r.reason}))};
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:cases.length,seconds:report.seconds,failures:cases.filter(c=>!c.pass)},null,2));if(!report.passed)process.exitCode=1;
}catch(e){fs.writeFileSync(path.join(out,'error.json'),JSON.stringify({rules:editorialRules(),error:e.message}));throw e;}
