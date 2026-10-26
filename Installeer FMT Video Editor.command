#!/bin/zsh
set -eu
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd "$(dirname "$0")"
zsh scripts/install-local.sh
