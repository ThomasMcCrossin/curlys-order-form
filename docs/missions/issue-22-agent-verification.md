# Issue #22 — isolated agent verification

- Owning issue: https://github.com/ThomasMcCrossin/curlys-order-form/issues/22
- Fleet request: https://github.com/ThomasMcCrossin/curlys-brain-kb/issues/345
- Branch: `verify/curlys-order-form-skill-20261013`
- Scope: executable verification helpers, project-local skill, feature map and
  Claude discovery symlink. No product behavior or deployment changes.

## Outcome and acceptance

Agents can launch an owned loopback instance, check its identity/readiness,
drive real web UI/Worker paths and preserve evidence after cleanup. Shopify
and Resend are synthetic outbound boundaries; no production credentials,
records, messages, services or money documents are used.

Acceptance requires the existing offline gate, a full launch/doctor/drive/
cleanup run of at least one mapped feature, preserved evidence under
`~/.local/state/verify/curlys-order-form/`, and a PR against `main` without merge.
The operator explicitly requires retaining this worktree.

## Implementation and evidence

- [Verification skill](../../.agents/skills/verify-curlys-order-form/SKILL.md)
- [Feature map](../../.agents/skills/verify-curlys-order-form/features/README.md)
- Exact run paths, verdicts and PR receipt are backpassed to issue #22 and
  fleet issue #345. Raw screenshots/traces stay outside the worktree.

## Non-interactive decisions

Use Node 22+ instead of changing the host default Node 18 or product modules.
Run headless Chromium, a Node Worker adapter and fake Shopify/Resend rather
than deploying or requesting credentials. Simulate the existing trusted-network
entry; password/remembered-device auth, Cloudflare deployment behavior and real
external-system effects remain unverified. Open choices are recorded under
**Open questions for Tom** in the PR, not treated as permission for live actions.
