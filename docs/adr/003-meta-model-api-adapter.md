# ADR-003: Meta Model API adapter

Status: Superseded for the restricted local proxy by ADR-012 and ADR-013

## Decision

Use a server-side Meta adapter for environment keys. A user-provided key may
also be forwarded only to the local proxy for a consented, restricted run; it
must never be bundled in a static deployment.

## Consequences

Account entitlements and exact multimodal payloads must be smoke-tested.
