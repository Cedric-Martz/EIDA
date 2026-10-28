# Development and GitHub setup

## Requirements

Node.js 22, npm 10, Git, GitHub CLI (`gh`) optional.

## Bootstrap

```bash
npm install
cp .env.example .env.local
npm run check
npm run dev
```

Commit `package-lock.json` after installation. `.env.local` is ignored. The current static build does not read provider credentials or expose an inference probe.

## Create GitHub repo

```bash
git init -b main
git add .
git commit -m "chore: bootstrap evidence-grounded reconstruction lab"
gh auth login
gh repo create YOUR_REPO_NAME --public --source=. --remote=origin --push
```

Use a temporary neutral repo name until naming review is complete. Do not run commands with unreviewed downloaded scripts.

## GitHub Project

Create one project manually, fields: Status, Priority, Milestone, Area, Estimate. Import issue data from `planning/issues.csv` or use `scripts/create-issues.sh` **after** verifying `gh auth status` and repo target. Scripts do not create a GitHub Project automatically.

## Smartphone testing

For Galaxy A32 5G, connect to an HTTPS dev origin trusted by the phone. A plain LAN HTTP URL may not allow camera capture. Never expose a future paid endpoint publicly without authentication, quotas and rate limits.
