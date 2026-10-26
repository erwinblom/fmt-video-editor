#!/bin/zsh
set -eu
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
project_dir="$(cd "$(dirname "$0")" && pwd)"
cd "$project_dir"
port="$(node --input-type=module -e "await import('./app/runtime-config.mjs');console.log(process.env.FMT_EDITOR_PORT||4319)")"
if ! /usr/bin/curl --max-time 2 -fsS "http://localhost:$port/api/health" >/dev/null 2>&1; then
  service="gui/$(/usr/bin/id -u)/nl.fmteditor.publicatiekandidaat"
  if /bin/launchctl print "$service" >/dev/null 2>&1; then
    /bin/launchctl kickstart "$service"
  else
    nohup node app/server.mjs >> app/server.log 2>&1 &
  fi
  for retry in {1..100}; do
    /usr/bin/curl --max-time 1 -fsS "http://localhost:$port/api/health" >/dev/null 2>&1 && break
    sleep 0.1
  done
fi
if ! /usr/bin/curl --max-time 2 -fsS "http://localhost:$port/api/health" >/dev/null 2>&1; then
  print 'De editor kon niet starten. Bekijk app/server.log of ~/Library/Logs/FMT-Editor-publicatie/.'
  exit 1
fi
/usr/bin/open "http://localhost:$port"
