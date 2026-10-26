#!/bin/zsh
set -eu
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_dir"
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin"
command -v node >/dev/null || { print 'Installeer eerst Node.js 22.16 of nieuwer.'; exit 1; }
command -v python3 >/dev/null || { print 'Installeer eerst Python 3.11 of nieuwer.'; exit 1; }
node scripts/check-app-icon.mjs
npm ci
[[ -x .venv/bin/python3 ]] || python3 -m venv .venv
.venv/bin/python3 -m pip install -r scripts/python-requirements.txt
mkdir -p app/data
[[ -f .fmt-local.json ]] || cp .fmt-local.example.json .fmt-local.json
[[ -f .env.local ]] || { cp .env.example .env.local; chmod 600 .env.local; }
print '\nBasis geïnstalleerd. Controle van de overige voorzieningen:'
node scripts/check-installation.mjs

node scripts/make-mac-app.mjs
