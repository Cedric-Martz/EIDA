# Privacy and data handling

- Photos and project metadata: local browser IndexedDB by design; browser storage can be evicted and export/backup is not yet a complete archival workflow.
- Connection test: the optional BYOK test sends only the user-supplied key in an authorization header to Meta Model API.
- API key: held in memory by default; optional session-only storage is explicit. It is not stored with project data, included in exports, or sent to EIDA/GitHub.
- Reconstruction: sends up to six user-approved photos and the extracted
  approved-source snapshot after an explicit per-run consent checkbox. Images
  and source URLs/text necessarily leave the device and are processed under the
  selected Meta account/model terms; no raw image is logged by EIDA.
- Local run history stores photo identifiers and locators, not duplicate image
  bytes. It also stores validated observations, resolved claims, consent,
  sanitized status/errors and aggregate token counts. It never stores the key,
  complete provider response or request prompt.
- The local server has no durable database, user accounts, shared quotas or
  multi-user isolation in MVP. Do not expose it as a public service.
- Logs: technical status codes and aggregate timing only; no raw images, PDF text, serial numbers, API keys or full prompts.
- Third-party manuals are not redistributed in the public repository without rights.
- Browser storage can be evicted; export/backup is required before real user reliance.
- Before enabling media analysis: show per-transfer consent and document retention,
  data transfer, deletion, costs, credit exhaustion behavior and current
  model-provider terms. GitHub Pages must contain only static documentation and
  synthetic/demo assets, never a shared provider key.
