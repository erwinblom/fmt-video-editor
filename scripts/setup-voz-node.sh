#!/bin/zsh
set -eu
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
runtime_dir="$project_dir/.runtime-voz-node"
command -v node >/dev/null || { print 'Installeer Node.js 22.16 of nieuwer.'; exit 1; }
command -v npm >/dev/null || { print 'Installeer npm bij Node.js.'; exit 1; }
print 'Optionele Voz-runtime: lees MODELVOORWAARDEN.md. Modelladen vraagt apart licentieverkeer, standaard geblokkeerd.'
mkdir -p "$runtime_dir"
cp "$project_dir/scripts/voz-node/package.json" "$runtime_dir/package.json"
cp "$project_dir/scripts/voz-node/package-lock.json" "$runtime_dir/package-lock.json"
npm ci --prefix "$runtime_dir" --no-audit --no-fund
