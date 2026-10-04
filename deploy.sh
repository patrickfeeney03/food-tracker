#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
case "${1:-production}" in
  staging|production) target="${1:-production}" ;;
  *) echo "Usage: ./deploy.sh staging|production" >&2; exit 1 ;;
esac
exec npm run "deploy:$target"
