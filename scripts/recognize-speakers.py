"""Local audio diarization. Models: official k2-fsa/sherpa-onnx release assets."""
import json, sys
from pathlib import Path
import soundfile as sf
import sherpa_onnx

models = Path(__file__).resolve().parent.parent / '.runtime-speakers/models'
config = sherpa_onnx.OfflineSpeakerDiarizationConfig(
    segmentation=sherpa_onnx.OfflineSpeakerSegmentationModelConfig(
        pyannote=sherpa_onnx.OfflineSpeakerSegmentationPyannoteModelConfig(
            model=str(models/'sherpa-onnx-pyannote-segmentation-3-0/model.onnx'))),
    embedding=sherpa_onnx.SpeakerEmbeddingExtractorConfig(model=str(models/'embedding.onnx'),num_threads=2),
    clustering=sherpa_onnx.FastClusteringConfig(num_clusters=int(sys.argv[3]),threshold=0.5),
    min_duration_on=0.2,min_duration_off=0.3)
if not config.validate():
    raise RuntimeError('Lokale spraakmodellen ontbreken of zijn niet leesbaar.')
audio, rate = sf.read(sys.argv[1], dtype='float32')
sd = sherpa_onnx.OfflineSpeakerDiarization(config)
if rate != sd.sample_rate:
    raise RuntimeError('Audio moet mono 16 kHz zijn.')
result = sd.process(audio, callback=lambda n,total: print(f'PROGRESS {round(100*n/total)}',flush=True) or 0)
turns=[dict(start=round(r.start,3),end=round(r.end,3),speakerId=f'voice{r.speaker+1}') for r in result.sort_by_start_time()]
Path(sys.argv[2]).write_text(json.dumps(turns))
