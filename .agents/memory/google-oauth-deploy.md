---
name: Google OAuth + deployment quirks
description: Lessons from wiring canonical Google OAuth auth and republishing this OCR app
---
- The canonical server/auth.ts (owner-provided) must stay verbatim; only domain values (fallback prod domain, trustedHosts) may change. Owner requires a line-by-line list of any edits vs original.
- Google creds live under GOOGLE_LOGIN_CLIENT_ID/SECRET (preferred names in auth.ts). "invalid_client" on the live site usually means prod is running an old build/old creds — republish.
- Deleting a Replit deployment also deletes its custom-domain links AND orphans the production DB; the publish UI then blocks until the old prod DB is deleted via Database pane → Settings.
- Dev DATABASE_URL (postgres:password@helium/heliumdb) looks fake but is correct — local proxy; owner has repeatedly worried it's wrong. Reassure, don't change.
- redirect_uri_mismatch after registering URIs in Google Console = propagation delay (5 min–hours); no app-side fix.
