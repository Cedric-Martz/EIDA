#!/usr/bin/env bash
set -euo pipefail
# Review planning/issues.csv and ensure `gh repo view` points to the intended repository.
command -v gh >/dev/null || { echo "Install GitHub CLI first"; exit 1; }
gh auth status >/dev/null
gh repo view --json nameWithOwner --jq .nameWithOwner
read -r -p "Create issues in this repository? Type CREATE: " answer
[[ "$answer" == "CREATE" ]] || exit 1
python3 scripts/create-issues.py
