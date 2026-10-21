# Dashboard visible notes — #31

## Request (2026-10-23)

Tom could add a note but could not find the saved notes, citing a received Maca/prostate request without customer email. This app belongs to `curlys-order-form`, not Books.

## Change

Move the note section from below products to immediately below customer details. Always show the section, with `No note added` when empty and a direct Add/Edit Note button. Preserve line breaks and wrap long text without truncation. Remove the redundant note action from More actions. No Worker or persistence changes.

## Verification

- `node --test worker/tests/*.test.mjs`: 58/58 passed.
- Isolated `dashboard` browser recipe: passed, including Ready/no-email note viewing at 1280px/390px and Compact after reload, exact multiline text and HTML escaping, with no mutations or outbound messages.
- Exercised code commit: `d6a86cb`, checkout `/home/clarencehub/worktrees/curlys-order-form/visible-notes`.
- Diagnostic artifacts: `~/.local/state/verify/curlys-order-form/run-GLtTjV/`; durable acceptance/deployment receipt belongs on [issue #31](https://github.com/ThomasMcCrossin/curlys-order-form/issues/31).
- Existing production `/dashboard` source was read before the change; it placed notes below products. Production order reads returned 401, so the actual Maca note contents were not inspected. No real order writes or emails attempted.
- Cloudflare project readback confirms GitHub `main` production auto-deploy, output directory `public` (the older deployment guide's manual-upload setup is historical).

Live note-save acceptance remains separate from this presentation change (#28).
