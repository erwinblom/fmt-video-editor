import {withSubtitleModel,SUBTITLE_API_MODEL} from './cloud-subtitle-model.mjs';
export const EDITORIAL_MODEL_ID=SUBTITLE_API_MODEL+'-low-v1';
export const EDITORIAL_MODEL_LABEL=SUBTITLE_API_MODEL+' (low)';
export async function withEditorialModel(dir,work,options={}){
 try{return await withSubtitleModel(dir,ask=>work((prompt,maxTokens=5000,schema)=>ask('Geef precies één JSON-object.\n'+prompt,Math.max(3500,maxTokens),schema)),{timeoutMs:180000,...options});}
 catch(error){throw new Error(error.message.replaceAll('ondertitelantwoord','redactionele antwoord'));}
}
