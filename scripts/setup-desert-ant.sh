#!/bin/zsh
set -eu
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
runtime_dir="$project_dir/.runtime-desert-ant"
revision=9ac125cc4b10696a7ae1d18723fb585b8c025ee1
print 'Optionele Desert Ant SDK: eigen bronbeschikbare licentie en modelvoorwaarden; lees MODELVOORWAARDEN.md. De demo/export vraagt deze SDK niet.'
mkdir -p "$runtime_dir"
if [[ ! -d "$runtime_dir/sdk/.git" ]]; then
 git clone https://github.com/Desert-Ant-Labs/desert-ant-core.git "$runtime_dir/sdk"
 git -C "$runtime_dir/sdk" checkout --detach "$revision"
fi
[[ "$(git -C "$runtime_dir/sdk" rev-parse HEAD)" == "$revision" ]] || { print 'Onverwachte SDK-versie; voorbereiding afgebroken.'; exit 1; }
swift build -c release --package-path "$project_dir/scripts/desert-ant" --scratch-path "$runtime_dir/build"
print 'Voz en Who gereed. Modellen worden bij eerste gebruik opgehaald. Powered by Desert Ant Labs: https://desertant.com/'

print 'Bij eerste gebruik is apart licentieverkeer nodig. Dit blijft uit totdat je bewust FMT_ALLOW_LICENSE_NETWORK=1 instelt; FMT_ALLOW_CLOUD regelt dat niet.'
