#!/usr/bin/env bash
PUBLIC_PATH="$PWD/public"
AGENDA_PATH="$PWD/agenda"

cd "$PUBLIC_PATH"
npm i
npm run build

cd "$AGENDA_PATH"
npm i
npm run build

cd ".."
npm i
npm run build
