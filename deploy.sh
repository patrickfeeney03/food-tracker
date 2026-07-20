#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/var/www/food-tracker/food-tracker
BRANCH=master

cd "$APP_DIR"

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

npm ci
npm run check
npm run db:migrate
npm run build

sudo systemctl restart food-tracker
