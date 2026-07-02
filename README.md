# 📄 DOCUMENT SCANNER

**Fast, Accurate OCR and Text Extraction for PDFs, Images, and Word Documents**

---

## 🧩 Overview

Document Scanner is a web-based text extraction platform that pulls clean, copy-ready text out of scanned PDFs, photographs, screenshots, plain text files, and Microsoft Word documents. It is built around a hybrid extraction engine: a fast local text parser handles digital PDFs and Word files instantly, while Azure Cognitive Services Computer Vision Read API handles scanned pages and image-based documents that require true OCR.

Unlike generic OCR tools that try to do everything and fail on large or image-heavy files, Document Scanner picks the right extraction path automatically. Lecture slides with embedded text return in seconds. Scanned receipts get the full OCR treatment. Large PDFs up to 300MB are accepted, and Word documents are converted with full text fidelity using mammoth. The extracted text is yours to copy, download, or combine with other files.

---

## 👥 Who It's For

- **Students and academics** -- need to convert lecture slides, scanned articles, and PDF textbooks into searchable, copy-pasteable text for notes and citations
- **Researchers and analysts** -- need to extract text from scanned reports, archival documents, and image-based PDFs that other tools choke on
- **Lawyers and legal professionals** -- need to digitize scanned contracts, depositions, and case files for review and search
- **Writers and editors** -- need to merge multiple Word and text drafts into a single working document
- **Office workers and administrators** -- need to extract text from scanned forms, receipts, invoices, and faxes
- **Anyone** -- who needs to get text out of a document and into a usable format without manual retyping

---

## ⚙️ Core Capabilities

- **Hybrid PDF Extraction** -- Automatically detects whether a PDF has embedded text or is image-based. Digital PDFs are parsed instantly using pdf-parse with zero image overhead -- perfect for lecture decks and slides where you only want the words. Scanned PDFs fall back to Azure Read OCR.

- **Image OCR** -- Extracts printed and handwritten text from PNG and JPG files using Azure Cognitive Services Computer Vision Read API v3.2, with multi-language support and high accuracy on real-world scans.

- **Word Document Conversion** -- Converts .docx files to plain text using mammoth, preserving paragraph structure and ignoring formatting noise. Works in both the main upload area and the file combiner.

- **Plain Text Passthrough** -- Accepts .txt files directly without unnecessary processing, returning the raw content immediately.

- **Combine Text Files** -- Merge multiple .txt and .docx files into a single output document. Includes drag-and-drop reordering, up/down arrow controls, and individual file removal so you control the exact final order.

- **Large File Support** -- Accepts files up to 300MB. Image-heavy slide decks that exceed Azure's 50MB OCR limit are still processed via the text-only path so they never get rejected for size.

- **Drag-and-Drop Upload** -- Drop files anywhere in the upload zone or use the file picker. Visual feedback indicates accepted formats and current upload state.

- **Copy and Download** -- Copy extracted text to clipboard with one click or download as a .txt file. Character count is displayed for every result.

- **Reset and Reuse** -- One-click reset clears the current document and result so you can immediately scan the next file without reloading the page.

- **Google OAuth Login** -- Sign in with your Google account using passport-google-oauth20. No passwords to manage, no separate account to create.

- **Stripe Payment Integration** -- $1 for 24-hour access to the OCR feature, handled through Stripe Checkout with webhook-verified payment confirmation. Access status is tracked per user in PostgreSQL.

- **Dark and Light Mode** -- Full theme toggle with system preference detection and localStorage persistence.

---

## 🚀 What Makes It Different

- **It picks the right tool for the job** -- Most OCR apps run every file through the same expensive OCR pipeline, which is slow and chokes on large image-heavy PDFs. Document Scanner uses fast local text extraction first and only invokes Azure OCR when the document is actually a scan. Lecture slides return in under a second.

- **It handles files other tools reject** -- A 100MB lecture deck full of embedded images normally fails on cloud OCR services because of size limits. Document Scanner extracts the text directly from the PDF stream and ignores the images entirely, so size is not a barrier.

- **It tells you what actually went wrong** -- When something fails, you get a clear, human-readable error message -- not a cryptic JSON parse error or a generic "something went wrong" toast. Server timeouts, oversized files, and OCR failures each surface with specific guidance.

- **It supports the full document lifecycle** -- Upload, extract, copy, download, and combine -- all in one interface. The combine tool accepts both .txt and .docx files in the same workflow, so you can merge mixed-format drafts without converting them separately first.

- **It respects your time** -- No watermarks, no signup walls before you can see the tool, no upsell modals. Pay $1 once and you get 24 hours of unlimited scanning.

- **It runs on your infrastructure** -- Built to use your own Neon PostgreSQL database, your own Google OAuth credentials, and your own Stripe account. You own the data, you control the billing, and you set the payment terms.
