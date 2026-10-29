# Privacy and data handling

- Photos and project metadata: local browser IndexedDB by design; user must be able to delete/export them (future implementation).
- Connection test: the optional BYOK test sends only the user-supplied key in an authorization header to Meta Model API.
- API key: held in memory by default; optional session-only storage is explicit. It is not stored with project data, included in exports, or sent to EIDA/GitHub.
- Photo analysis: the first slice sends at most three user-approved photos after
  an explicit per-action consent checkbox. Images leave the browser and are
  processed under the selected Meta account/model terms; no raw image is
  logged by EIDA.
- Local run history stores photo identifiers and locators, not duplicate image
  bytes. It also stores validated observations, resolved claims, consent,
  sanitized status/errors and aggregate token counts. It never stores the key,
  complete provider response or request prompt.
- No server-side database, no user accounts in MVP.
- Logs: technical status codes and aggregate timing only; no raw images, PDF text, serial numbers, API keys or full prompts.
- Third-party manuals are not redistributed in the public repository without rights.
- Browser storage can be evicted; export/backup is required before real user reliance.
- Before enabling media analysis: show per-transfer consent and document retention, data transfer, deletion, costs, and current model-provider terms.
