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

Commit `package-lock.json` after installation. `.env.local` is ignored. `MODEL_API_KEY` is read only by the local Next.js server; never use a `NEXT_PUBLIC_` variable for it.

## What runs where

The live local workflow is:

1. Browser stores photos and project state in IndexedDB.
2. The local Next.js server fetches only user-approved public HTTPS sources and extracts bounded HTML/text evidence.
3. The server proxies Muse inventory and SAM 3.1 requests with the environment key or a session key.
4. The browser builds silhouettes, GLB assets, assembly diagnostics and the viewer locally.

No paid search, GPU, database, queue, object storage or external CAD service is required. The optional `services/` directories are contracts/research material, not prerequisites.

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

For Galaxy A32 5G, connect to an HTTPS dev origin trusted by the phone. A plain LAN HTTP URL may not allow camera capture. Never expose the local server publicly: it has no user accounts, durable quota enforcement or multi-user isolation.

## GitHub Pages

GitHub Pages is suitable for a separate static documentation and synthetic 3D demo build. It cannot safely run the live workflow because Pages cannot protect `MODEL_API_KEY` or host the server routes used for source extraction, Muse and SAM. The current workflow validates the repository; publishing the static showcase requires a dedicated static entry point and fixture assets.
