# Contributing

- Node.js 22; TypeScript strict; prefer pure domain functions.
- Run `npm run format`, `npm run check` before opening a PR.
- Conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- Every new feature needs acceptance criteria and relevant tests.
- No paid Meta API calls in automated tests. Use deterministic fixtures.
- Never introduce inferred geometry as verified; all dimensions require provenance or `estimated: true`.
- Keep the domain independent of React, Next.js, Three.js and Meta SDKs.
- Document architectural changes as ADRs.
