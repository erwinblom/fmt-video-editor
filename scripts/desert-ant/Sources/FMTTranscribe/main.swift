// Desert Ant Labs Voz / Who / Ear / SDK: https://license.desertant.com
// Powered by Desert Ant Labs: https://desertant.com
import Foundation
import Voz
import Who
import Ear

@main struct FMTTranscribe {
 static func main() async {
  do {
   let args = CommandLine.arguments
   guard args.count >= 5 else { throw NSError(domain:"FMT",code:1,userInfo:[NSLocalizedDescriptionKey:"Gebruik: FMTTranscribe voz|who audio output modelcache [taal]"]) }
   let mode=args[1], url=URL(fileURLWithPath:args[2]), output=URL(fileURLWithPath:args[3]), cache=args[4]
   var result:[String:Any]=[:]
   let start=Date()
   if mode == "voz" {
    var language=args.count>5 ? args[5] : "auto"
    if language == "auto" {
     let detection=try await Ear(directory:nil,cacheRoot:cache).identify(contentsOf:url)
     guard detection.isReliable, let detected=detection.language else { throw NSError(domain:"FMT",code:2,userInfo:[NSLocalizedDescriptionKey:"Kies de brontaal: automatische taalherkenning is onzeker."]) }
     language=detected
    }
    guard ["bg","hr","cs","da","nl","en","et","fi","fr","de","el","hu","it","lv","lt","mt","pl","pt","ro","ru","sk","sl","es","sv","uk"].contains(language) else {throw NSError(domain:"FMT",code:3,userInfo:[NSLocalizedDescriptionKey:"Deze brontaal wordt niet door Voz ondersteund."])}
    let model=try await Voz(cacheRoot:cache)
    let transcript=try await model.transcribe(url)
    result=["text":transcript.text,"language":language,"words":transcript.words.map{["text":$0.text,"start":$0.start,"end":$0.end] as [String:Any]},"engine":"Voz v0.4.0 / Desert Ant SDK 4.0.0"]
   } else if mode == "who" {
    let model=Who(directory:nil,cacheRoot:cache,computeUnits:.cpuOnly)
    try await model.download()
    let diarization=try await model.diarize(contentsOf:url)
    result=["turns":diarization.turns.map{["speakerId":"voice\($0.speaker+1)","start":$0.start,"end":$0.end] as [String:Any]},"engine":"Who v0.3.1 fp16 CPU / Desert Ant SDK 4.0.0"]
   } else {throw NSError(domain:"FMT",code:4,userInfo:[NSLocalizedDescriptionKey:"Onbekende bewerking"])}
   result["elapsedSeconds"]=Date().timeIntervalSince(start)
   try JSONSerialization.data(withJSONObject:result,options:[.prettyPrinted,.sortedKeys]).write(to:output,options:.atomic)
  } catch {
   FileHandle.standardError.write(Data((error.localizedDescription+"\n").utf8));exit(1)
  }
 }
}
