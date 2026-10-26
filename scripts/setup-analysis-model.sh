#!/bin/sh
set -eu
PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
MODEL_DIR="$PROJECT_DIR/.runtime-models/analysis"
MODEL_NAME='gemma-4-E4B-it-Q4_K_M.gguf'
MODEL_SHA='85a896a047553e842f25297ee5b031d64ff30147d9c4af17b1e4b394cd1fab87'
MODEL_URL='https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/resolve/bfc15c382204943c3a8fff0c750b94ae2364d7a3/gemma-4-E4B-it-Q4_K_M.gguf'
printf '%s\n' 'Optioneel analysemodel: ongeveer 5 GB, Apache-2.0. Zie MODELVOORWAARDEN.md. Geen modelwissel; geen opname wordt verstuurd.'
mkdir -p "$MODEL_DIR"
if [ -f "$MODEL_DIR/$MODEL_NAME" ]; then
 printf '%s  %s\n' "$MODEL_SHA" "$MODEL_DIR/$MODEL_NAME" | shasum -a 256 -c -
 exit 0
fi
curl -L --fail --retry 2 -o "$MODEL_DIR/$MODEL_NAME.partial" "$MODEL_URL"
printf '%s  %s\n' "$MODEL_SHA" "$MODEL_DIR/$MODEL_NAME.partial" | shasum -a 256 -c -
mv "$MODEL_DIR/$MODEL_NAME.partial" "$MODEL_DIR/$MODEL_NAME"
printf '%s\n' 'Model gecontroleerd. Installeer apart een passende llama.cpp/llama-server; eventuele eigen model- en CLI-paden kunnen in .fmt-local.json.'
