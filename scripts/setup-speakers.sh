#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON="${FMT_SPEAKER_BOOTSTRAP_PYTHON:-python3}"
"$PYTHON" -m venv "$ROOT/.runtime-speakers"
"$ROOT/.runtime-speakers/bin/pip" install -r "$ROOT/scripts/speaker-requirements.txt"
MODELS="$ROOT/.runtime-speakers/models"
mkdir -p "$MODELS"
curl -fL 'https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-segmentation-models/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2' -o "$MODELS/segmentation.tar.bz2"
curl -fL 'https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx' -o "$MODELS/embedding.onnx"
(cd "$MODELS" && printf '%s\n' '24615ee884c897d9d2ba09bb4d30da6bb1b15e685065962db5b02e76e4996488  segmentation.tar.bz2' '1a331345f04805badbb495c775a6ddffcdd1a732567d5ec8b3d5749e3c7a5e4b  embedding.onnx' | shasum -a 256 -c -)
tar xjf "$MODELS/segmentation.tar.bz2" -C "$MODELS"
