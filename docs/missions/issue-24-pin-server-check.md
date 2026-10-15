# Issue #24 — staff PIN checked by the Worker; staff APIs require auth

- Owning issue: https://github.com/ThomasMcCrossin/curlys-order-form/issues/24
- Branch: `security/pin-server-check-20261015`
- Scope: Worker login/session/verify endpoints, per-IP login rate limit, pages
  without the PIN, staff-route enforcement. Same PIN and staff experience.

## Rollout

Pages and the Worker both auto-deploy from `main`, so each stage merges alone
and is read back live before the next:

1. Worker adds `POST /api/auth/login`, `GET /api/auth/verify`, `LOGIN_LIMITER`
   and session tokens (`ORDER_FORM_SESSION_SECRET`). Nothing is blocked yet.
2. Pages log in through the Worker, migrate saved `{hash}` remembered-device
   logins to session tokens silently, and send `x-order-form-auth` on every
   Worker call.
3. Worker requires the work IP or a session token on every staff route.

## Retire / rollback

Revert the stage's merge commit on `main` (auto-deploys). Stage 3 alone is the
enforcement; reverting it reopens the APIs while keeping the PIN out of the
pages. Rotating `ORDER_FORM_SESSION_SECRET` signs every device out.
