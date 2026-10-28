# Security policy

## Reporting

Do not open a public issue containing API keys, private photographs, sensitive documents, or exploitable security details. Contact the repository maintainer privately using GitHub's private vulnerability reporting after enabling it, or a private channel listed by the maintainer.

## Threat model (MVP)

- Paid Meta API abuse and key exfiltration.
- Prompt injection from imported documents.
- Private image leakage and unintended server-side persistence.
- Malicious PDFs and oversized uploads.
- False claims about hidden components and unsafe battery guidance.

## Controls

- The current static build contains no shared provider key, server route or paid inference call.
- BYOK credentials are held in memory by default and may be stored in `sessionStorage` only after an explicit user choice. They are never logged or included in project exports.
- No model-provider calls run in CI.
- Maintainer-owned or shared provider credentials must remain in a separately protected server environment and must never use a `NEXT_PUBLIC_` variable.
- Future document parsers must limit file types and sizes and isolate untrusted content.
- Never log images, raw documents, credentials, or complete model responses containing personal data.
- Do not follow repair advice involving battery puncture, swelling, heat, or energized circuits.
- Never publish user images, device serial numbers, or proprietary service manuals without authorization.

## Before any public deployment

Before offering a shared-key service, implement real authentication, per-user server-enforced quotas, rate limiting, upload size limits, CSRF/origin protections, audit of Meta data retention, and abuse monitoring. A public GitHub repository is **not** a shared-key production deployment. A browser-only BYOK prototype transfers cost and key control to the visitor but still requires explicit media consent and clear provider terms.
