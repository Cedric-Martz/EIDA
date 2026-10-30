#!/usr/bin/env bash
set -euo pipefail

api_dir="src/app/api"
api_backup=".pages-api-backup"
restore() {
  if [ -d "$api_backup" ]; then
    mv "$api_backup" "$api_dir"
  fi
}
trap restore EXIT

rm -rf "$api_backup"
mv "$api_dir" "$api_backup"
rm -rf .next .next-dev out
GITHUB_PAGES=true NEXT_PUBLIC_STATIC_SHOWCASE=true npm run build
