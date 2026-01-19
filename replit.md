# Document Scanner - OCR Text Extraction App

## Overview
A web application that extracts text from scanned PDFs and images (PNG, JPG) using Azure Cognitive Services Computer Vision API. Users can upload files up to 300MB via drag-and-drop or file picker, then copy or download the extracted text.

## Features
- Google OAuth login with persistent session
- Drag-and-drop file upload
- Support for PDF, PNG, and JPG files (up to 300MB)
- OCR text extraction using Azure Computer Vision Read API
- Copy extracted text to clipboard
- Download extracted text as .txt file
- Reset button to clear results and start over
- Dark/light mode toggle
- Responsive design

## Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js, Multer (file uploads), Axios (Azure API calls)
- **API**: Azure Cognitive Services Computer Vision Read API v3.2

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
- `POST /api/ocr` - Upload file and extract text
  - Accepts: `multipart/form-data` with `file` field
  - Returns: `{ text: string, pages: number }`

## Environment Variables
- `AZURE_COGNITIVE_ENDPOINT` - Azure Computer Vision endpoint URL
- `AZURE_COGNITIVE_KEY` - Azure Computer Vision API key
- `SESSION_SECRET` - Secret key for session encryption
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_REDIRECT_URI` - Google OAuth redirect URI (e.g., https://yourapp.replit.app/auth/google/callback)

## Running the App
The app runs via the "Start application" workflow which executes `npm run dev`. The frontend and backend are served together on port 5000.
