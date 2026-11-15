# Environment variables

Configure these in Coolify's environment-variable settings. Keep secret values
out of source control.

| Variable | Required to start | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string for the external Neon database. Required for visitor analytics and database-backed app behavior. |
| `PORT` | No | `5000` | HTTP port. Keep this aligned with the Coolify container port. |
| `NODE_ENV` | No | `production` in Docker | Runtime mode. The Dockerfile sets this to `production`. |
| `AZURE_COGNITIVE_ENDPOINT` | No | — | Azure Computer Vision endpoint for OCR of images and scanned PDFs. |
| `AZURE_COGNITIVE_KEY` | No | — | Azure Computer Vision key. Used with `AZURE_COGNITIVE_ENDPOINT`; not needed to start the app or process text-based PDFs, TXT, or DOCX files. |

The Azure variables are optional at startup. Image OCR and scanned-PDF OCR need
both configured; without them, those OCR operations return a clear error.

The app does not currently read Google OAuth, Stripe, `SESSION_SECRET`, or
`PUBLIC_BASE_URL` variables.
