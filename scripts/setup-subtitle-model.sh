#!/bin/sh
# Local, Apache-2.0 Qwen subtitle model. Existing transcript-analysis model stays separate.
set -eu
PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
MODEL_DIR="$PROJECT_DIR/.runtime-desert-ant/subtitle-model"
MODEL_NAME='Qwen3.5-9B-Q4_K_M.gguf'
MODEL_SHA='03b74727a860a56338e042c4420bb3f04b2fec5734175f4cb9fa853daf52b7e8'
MODEL_URL='https://huggingface.co/unsloth/Qwen3.5-9B-GGUF/resolve/99a1b2185534379e6e8b5ec869da25d3e7b3f73c/Qwen3.5-9B-Q4_K_M.gguf'
mkdir -p "$MODEL_DIR"
if [ -f "$MODEL_DIR/$MODEL_NAME" ]; then
  printf '%s  %s\n' "$MODEL_SHA" "$MODEL_DIR/$MODEL_NAME" | shasum -a 256 -c -
  exit 0
fi
curl -L --fail --retry 2 -o "$MODEL_DIR/$MODEL_NAME.partial" "$MODEL_URL"
printf '%s  %s\n' "$MODEL_SHA" "$MODEL_DIR/$MODEL_NAME.partial" | shasum -a 256 -c -
mv "$MODEL_DIR/$MODEL_NAME.partial" "$MODEL_DIR/$MODEL_NAME"
