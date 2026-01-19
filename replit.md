# Document Scanner - OCR Text Extraction App

## Overview
A web application that extracts text from scanned PDFs and images (PNG, JPG) using Azure Cognitive Services Computer Vision API. Users can upload files up to 300MB via drag-and-drop or file picker, then copy or download the extracted text. Users must pay $1 for 1-day access to use the OCR feature.

## Features
- **Google OAuth login** via passport-google-oauth20 (user's own credentials)
- **Stripe payment** - $1 for 1-day access to OCR feature
- Drag-and-drop file upload
- Support for PDF, PNG, and JPG files (up to 300MB)
- OCR text extraction using Azure Computer Vision Read API
- Copy extracted text to clipboard
- Download extracted text as .txt file
- **Combine TXT Files** - Merge multiple .txt files into one
- Reset button to clear results and start over
- Dark/light mode toggle
- Responsive design

## Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js, Multer (file uploads), Axios (Azure API calls), Stripe
- **Database**: PostgreSQL (Neon) with Drizzle ORM and node-postgres driver
- **Authentication**: Google OAuth 2.0 via passport-google-oauth20
- **Payments**: Stripe Checkout for one-time $1 payment
- **API**: Azure Cognitive Services Computer Vision Read API v3.2

## Recent Changes (January 2026)
- Added Stripe payment integration - users pay $1 for 1-day access
- Added payments table to track user subscriptions
- Added paywall UI that shows when user doesn't have active access
- Added "Combine TXT Files" feature
- Switched from Replit Auth to direct Google OAuth using user's own credentials
- Updated database driver from neon-http to node-postgres for better compatibility
- Added `/auth/google` and `/auth/google/callback` routes for OAuth flow
- Fixed session cookie settings for HTTPS (secure: true, sameSite: lax)

## Project Structure
```
client/
├── src/
│   ├── components/
│   │   ├── theme-provider.tsx    # Dark mode provider
│   │   └── theme-toggle.tsx      # Theme toggle button
│   ├── pages/
│   │   └── home.tsx              # Main OCR interface
│   └── App.tsx                   # App routing
server/
├── routes.ts                     # API endpoints (/api/ocr)
└── index.ts                      # Express server setup
```

## API Endpoints
- `POST /api/ocr` - Upload file and extract text (requires auth + paid access)
  - Accepts: `multipart/form-data` with `file` field
  - Returns: `{ text: string, pages: number }`
- `GET /api/access-status` - Check user's payment/access status
  - Returns: `{ hasAccess: boolean, expiresAt: string | null }`
- `POST /api/create-checkout-session` - Create Stripe checkout session
  - Returns: `{ url: string }`
- `POST /api/stripe-webhook` - Stripe webhook handler for payment events

## Environment Variables
- `AZURE_COGNITIVE_ENDPOINT` - Azure Computer Vision endpoint URL
- `AZURE_COGNITIVE_KEY` - Azure Computer Vision API key
- `DATABASE_URL` - PostgreSQL connection string (auto-configured)
- `SESSION_SECRET` - Session encryption key (auto-configured)
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `STRIPE_PRICE_ID` - Stripe price ID for the $1 product

## Running the App
The app runs via the "Start application" workflow which executes `npm run dev`. The frontend and backend are served together on port 5000.
