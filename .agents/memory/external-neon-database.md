---
name: External Neon database
description: The app must use the user's external Neon PostgreSQL database.
---

Use the user's external Neon PostgreSQL database as the app's canonical database through `DATABASE_URL`. Do not switch the app to Replit-managed PostgreSQL. The connected Neon database already contains legacy `payments`, `sessions`, and `users` tables; preserve them.

**Why:** The user explicitly directed this project to use their external Neon PostgreSQL database, and existing data there must remain intact.

**How to apply:** Before changing schema, inspect the external database and use additive changes for app tables that are missing. Avoid schema pushes that might drop or rewrite the pre-existing tables.
