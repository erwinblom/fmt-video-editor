import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {withLocalModel} from './local-analysis-model.mjs';
export const SUBTITLE_MODEL_ID='Qwen3.5-9B-Q4_K_M-03b74727-thinking512-v1';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const SUBTITLE_MODEL_PATH=path.join(root,'.runtime-desert-ant/subtitle-model/Qwen3.5-9B-Q4_K_M.gguf');
export async function withSubtitleModel(dir,work){
 if(!fs.existsSync(SUBTITLE_MODEL_PATH))throw Error('Het lokale ondertitelmodel ontbreekt. Voer scripts/setup-subtitle-model.sh uit. Je montage blijft behouden.');
 return withLocalModel(dir,ask=>work((prompt,maxTokens)=>ask(prompt,Math.min(8000,maxTokens+1024))),{modelPath:SUBTITLE_MODEL_PATH,reasoning:true,reasoningBudget:512,temperature:0.6});
}
