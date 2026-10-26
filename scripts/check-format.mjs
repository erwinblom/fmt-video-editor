import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {consolidateThemes,attachQuestions} from '../app/thematic-analysis.mjs';
import {withLocalModel} from '../app/local-analysis-model.mjs';
import {withEditorialRules,editorialRules} from '../app/editorial-rules.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const f=JSON.parse(fs.readFileSync(path.join(root,'app/tests/fixtures/synthetic-format.json')));
const out=path.resolve(process.argv[2]||path.join(root,'controle/formatproef',new Date().toISOString().replace(/[:.]/g,'-')));fs.mkdirSync(out,{recursive:true});
const start=performance.now();
await withLocalModel(out,async raw=>{
 const ask=withEditorialRules(raw),assignments=f.passages.map(p=>({id:p.id,theme:p.theme}));
 const themes=await consolidateThemes(f.passages,assignments,ask,console.log,new Map());
 const topic=id=>themes.findIndex(t=>t.labels.includes(f.passages.find(p=>p.id===id).theme));
 const questions=await attachQuestions(f.questions,ask,console.log,new Map());
 const cases=[...f.sameTopic.map(([a,b])=>({name:a+' + '+b+' samen',pass:topic(a)>=0&&topic(a)===topic(b)})),...f.differentTopics.map(([a,b])=>({name:a+' / '+b+' apart',pass:topic(a)>=0&&topic(b)>=0&&topic(a)!==topic(b)})),{name:'Vraag blijft bij antwoord; volgend onderwerp apart',pass:questions.length===2&&questions[0].text===f.questions[0].text+' '+f.questions[1].text&&questions[1].text===f.questions[2].text}];
 const result={rules:editorialRules(),seconds:(performance.now()-start)/1000,passed:cases.every(c=>c.pass),cases,themes,questions};fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;
});
