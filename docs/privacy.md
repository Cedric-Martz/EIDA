# Privacy and data handling

- Photos and project metadata: local browser IndexedDB by design; user must be able to delete/export them (future implementation).
- Current build: the optional BYOK connection test sends only the user-supplied key in an authorization header to Meta Model API. It does not transfer imported files.
- API key: held in memory by default; optional session-only storage is explicit. It is not stored with project data, included in exports, or sent to EIDA/GitHub.
- Future inference: only after explicit consent and input minimization; it will not be offline.
- No server-side database, no user accounts in MVP.
- Logs: technical status codes and aggregate timing only; no raw images, PDF text, serial numbers, API keys or full prompts.
- Third-party manuals are not redistributed in the public repository without rights.
- Browser storage can be evicted; export/backup is required before real user reliance.
- Before enabling media analysis: show per-transfer consent and document retention, data transfer, deletion, costs, and current model-provider terms.
