# ADR-007: Local restricted demo

Status: Accepted

## Decision

Run the live reconstruction locally; do not expose the Meta/source routes
publicly. Use GitHub Pages only for documentation and a synthetic 3D demo.

## Consequences

Remote/mobile testing needs HTTPS and deliberate access design. The current
path intentionally avoids paid search, GPU, database and storage services, so
it has no public accounts, quotas or durable multi-user isolation.
