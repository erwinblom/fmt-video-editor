export const VOZ_LANGUAGES=new Set('bg hr cs da nl en et fi fr de el hu it lv lt mt pl pt ro ru sk sl es sv uk'.split(' '));
export function detectedLanguage(log){
 const m=/auto-detected language: ([a-z]{2}) \(p = ([0-9.]+)\)/.exec(log);
 if(!m||!VOZ_LANGUAGES.has(m[1])||Number(m[2])<.8)throw Error('Kies de brontaal: automatische taalherkenning is onzeker of niet door Voz ondersteund.');
 return m[1];
}
