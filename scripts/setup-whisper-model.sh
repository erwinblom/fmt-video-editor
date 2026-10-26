#!/bin/sh
set -eu
PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
MODEL_DIR="$PROJECT_DIR/.runtime-models/whisper"
MODEL_NAME='ggml-small.bin'
MODEL_SHA='1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b'
MODEL_URL='https://huggingface.co/ggerganov/whisper.cpp/resolve/80da2d8bfee42b0e836fc3a9890373e5defc00a6/ggml-small.bin'
printf '%s\n' 'Optionele Whisper-small-gewichten: ongeveer 488 MB, MIT. Zie MODELVOORWAARDEN.md. whisper-cli zelf wordt niet geïnstalleerd.'
mkdir -p "$MODEL_DIR"
if [ -f "$MODEL_DIR/$MODEL_NAME" ]; then
 printf '%s  %s\n' "$MODEL_SHA" "$MODEL_DIR/$MODEL_NAME" | shasum -a 256 -c -
 exit 0
fi
curl -L --fail --retry 2 -o "$MODEL_DIR/$MODEL_NAME.partial" "$MODEL_URL"
printf '%s  %s\n' "$MODEL_SHA" "$MODEL_DIR/$MODEL_NAME.partial" | shasum -a 256 -c -
mv "$MODEL_DIR/$MODEL_NAME.partial" "$MODEL_DIR/$MODEL_NAME"
