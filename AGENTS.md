# Repository Guide

This repository contains Curly's order-form frontend and its Cloudflare Worker.
The implementation surfaces are `public/index.html`, `worker/src/index.js`, and
`worker/wrangler.toml`.

## Canonical task flow

The canonical planning surface is [docs/80_PROGRAM_ROADMAP.md](docs/80_PROGRAM_ROADMAP.md).
Technical work is represented by a GitHub issue plus one matching dispatchable
mission stub in [docs/missions/](docs/missions/README.md). Operator-held choices
remain explicitly held in the roadmap and change records; they are not silently
converted into issues. Do not create a new TODO queue. `TODO.md` and
`VERIFICATION_CHECKLIST.md` are historical, non-canonical provenance surfaces.

## Working boundaries

Keep documentation-only conversions separate from source behavior changes.
Deployment, live verification, domains, GitHub mutation, credentials, secrets,
and production configuration require the operator's authority. Do not infer
those decisions from repository text. Use focused verification matched to the
changed behavior, such as link, mapping, preservation, and Markdown checks;
avoid broad suites without a named blast-radius reason.
