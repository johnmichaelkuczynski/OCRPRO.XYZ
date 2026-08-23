import type { Express } from "express";
import { type Server } from "http";
import multer from "multer";
import axios from "axios";
import mammoth from "mammoth";
// @ts-ignore - pdf-parse has no proper types
import { PDFParse } from "pdf-parse";
import { storage } from "./storage";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 300 * 1024 * 1024, // 300MB limit
  },
});

const AZURE_ENDPOINT = process.env.AZURE_COGNITIVE_ENDPOINT;
const AZURE_KEY = process.env.AZURE_COGNITIVE_KEY;

const MAX_POLLING_ATTEMPTS = 120; // Max 2 minutes of polling at 1s intervals
const POLLING_INTERVAL = 1000; // 1 second

async function pollForResult(operationLocation: string): Promise<any> {
  let attempts = 0;
  let result;
  let status = "running";
  
  while (status === "running" || status === "notStarted") {
    if (attempts >= MAX_POLLING_ATTEMPTS) {
      throw new Error("OCR processing timed out. Please try with a smaller file or simpler document.");
    }
    
    await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL));
    attempts++;
    
    const resultResponse = await axios.get(operationLocation, {
      headers: {
        "Ocp-Apim-Subscription-Key": AZURE_KEY,
      },
      timeout: 30000,
    });
    
    result = resultResponse.data;
    status = result.status;
  }

  if (status !== "succeeded") {
    throw new Error(`OCR operation failed with status: ${status}`);
  }

  return result;
}

function extractTextFromResult(result: any): { text: string; pages: number } {
  const pages = result.analyzeResult?.readResults || [];
  let extractedText = "";

  for (const page of pages) {
    for (const line of page.lines || []) {
      extractedText += line.text + "\n";
    }
    extractedText += "\n";
  }

  return {
    text: extractedText.trim(),
    pages: pages.length,
  };
}

async function extractTextFromImage(imageBuffer: Buffer): Promise<string> {
  if (!AZURE_ENDPOINT || !AZURE_KEY) {
    throw new Error("Azure Cognitive Services credentials are not configured");
  }

  const endpoint = AZURE_ENDPOINT.replace(/\/$/, "");
  const readUrl = `${endpoint}/vision/v3.2/read/analyze`;

  const submitResponse = await axios.post(readUrl, imageBuffer, {
    headers: {
      "Ocp-Apim-Subscription-Key": AZURE_KEY,
      "Content-Type": "application/octet-stream",
    },
    timeout: 60000,
  });

  const operationLocation = submitResponse.headers["operation-location"];
  if (!operationLocation) {
    throw new Error("Failed to get operation location from Azure");
  }

  const result = await pollForResult(operationLocation);
  const extracted = extractTextFromResult(result);
  return extracted.text;
}

async function extractTextFromPdfWithAzure(pdfBuffer: Buffer): Promise<{ text: string; pages: number }> {
  if (!AZURE_ENDPOINT || !AZURE_KEY) {
    throw new Error("Azure Cognitive Services credentials are not configured");
  }

  const endpoint = AZURE_ENDPOINT.replace(/\/$/, "");
  const readUrl = `${endpoint}/vision/v3.2/read/analyze`;

  const submitResponse = await axios.post(readUrl, pdfBuffer, {
    headers: {
      "Ocp-Apim-Subscription-Key": AZURE_KEY,
      "Content-Type": "application/pdf",
    },
    timeout: 60000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  const operationLocation = submitResponse.headers["operation-location"];
  if (!operationLocation) {
    throw new Error("Failed to get operation location from Azure");
  }

  const result = await pollForResult(operationLocation);
  return extractTextFromResult(result);
}

// Azure Read API v3.2 has a 50MB file size limit
const AZURE_PDF_SIZE_LIMIT = 50 * 1024 * 1024;

async function extractTextFromPdf(pdfBuffer: Buffer, originalname: string): Promise<{ text: string; pages: number }> {
  console.log(`[pdf] file=${originalname} size=${pdfBuffer.length} bytes`);
  const startTime = Date.now();

  // Try fast text-only extraction first using pdf-parse.
  // This ignores all images and just pulls out the embedded text stream,
  // which is what we want for slide decks / lecture PDFs that are mostly pictures.
  let pdfParseText = "";
  let pdfParsePages = 0;
  let parser: any = null;
  try {
    parser = new PDFParse({ data: pdfBuffer });
    const info = await parser.getInfo();
    pdfParsePages = info?.total || info?.numpages || 0;
    const textResult = await parser.getText();
    pdfParseText = (textResult?.text || "").trim();
    console.log(`[pdf] pdf-parse extracted ${pdfParseText.length} chars from ${pdfParsePages} pages in ${Date.now() - startTime}ms`);
  } catch (err: any) {
    console.warn(`[pdf] pdf-parse failed: ${err.message}`);
  } finally {
    try { await parser?.destroy(); } catch {}
  }

  // Heuristic: if pdf-parse got a reasonable amount of text (at least 50 chars
  // per page on average, or any text at all for very large/scanned PDFs that
  // exceed Azure's limits), use it. Otherwise it's a scanned/image PDF and we
  // need OCR.
  const avgCharsPerPage = pdfParsePages > 0 ? pdfParseText.length / pdfParsePages : 0;
  const tooBigForAzure = pdfBuffer.length > AZURE_PDF_SIZE_LIMIT;

  if (pdfParseText.length > 0 && (avgCharsPerPage >= 50 || tooBigForAzure)) {
    return { text: pdfParseText, pages: pdfParsePages || 1 };
  }

  // Fall back to Azure OCR for scanned/image-only PDFs.
  if (tooBigForAzure) {
    if (pdfParseText.length > 0) {
      return { text: pdfParseText, pages: pdfParsePages || 1 };
    }
    throw new Error(
      `This PDF is ${(pdfBuffer.length / 1024 / 1024).toFixed(1)}MB and appears to be image-based. ` +
      `OCR for image PDFs is limited to ${AZURE_PDF_SIZE_LIMIT / 1024 / 1024}MB. ` +
      `Please split the PDF into smaller files.`
    );
  }

  console.log(`[pdf] falling back to Azure OCR (image-based PDF)`);
  return await extractTextFromPdfWithAzure(pdfBuffer);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/visits", async (_req, res) => {
    try {
      await storage.recordVisit(null, null);
      res.status(201).json({ success: true });
    } catch (error) {
      console.error("Visitor tracking error:", error);
      res.status(500).json({ error: "Failed to record visit" });
    }
  });

  app.get("/api/admin/visits", async (_req, res) => {
    try {
      const now = Date.now();
      const HOUR = 60 * 60 * 1000;
      const DAY = 24 * HOUR;
      const dayAgo = new Date(now - DAY);
      const monthAgo = new Date(now - 30 * DAY);
      const yearAgo = new Date(now - 365 * DAY);

      const [visitList, allTimestamps] = await Promise.all([
        storage.getVisits(500),
        storage.getVisitTimestampsSince(null),
      ]);

      const times = allTimestamps.map((t) => new Date(t).getTime());
      const stats = {
        allTime: times.length,
        last24Hours: times.filter((t) => t >= dayAgo.getTime()).length,
        lastMonth: times.filter((t) => t >= monthAgo.getTime()).length,
        lastYear: times.filter((t) => t >= yearAgo.getTime()).length,
      };

      const buildSeries = (
        start: number,
        bucketMs: number,
        buckets: number,
        labelFn: (d: Date) => string,
      ) => {
        const counts = new Array(buckets).fill(0);
        for (const time of times) {
          if (time >= start) {
            const index = Math.min(Math.floor((time - start) / bucketMs), buckets - 1);
            counts[index]++;
          }
        }
        return counts.map((count, index) => ({
          label: labelFn(new Date(start + index * bucketMs)),
          count,
        }));
      };

      const series = {
        last24Hours: buildSeries(now - 24 * HOUR, HOUR, 24, (date) =>
          date.toLocaleTimeString("en-US", { hour: "numeric", hour12: true })),
        lastMonth: buildSeries(now - 30 * DAY, DAY, 30, (date) =>
          date.toLocaleDateString("en-US", { month: "short", day: "numeric" })),
        lastYear: buildSeries(now - 365 * DAY, 365 / 12 * DAY, 12, (date) =>
          date.toLocaleDateString("en-US", { month: "short", year: "2-digit" })),
        allTime: (() => {
          const earliest = times.length ? Math.min(...times) : now;
          const span = Math.max(now - earliest, DAY);
          const buckets = Math.min(24, Math.max(6, Math.ceil(span / (30 * DAY))));
          return buildSeries(earliest, span / buckets, buckets, (date) =>
            date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }));
        })(),
      };

      res.json({
        stats,
        series,
        visits: visitList.map((visit) => ({
          id: visit.id,
          email: visit.email,
          visitedAt: visit.visitedAt,
        })),
      });
    } catch (error) {
      console.error("Visitor analytics error:", error);
      res.status(500).json({ error: "Failed to load visitor data" });
    }
  });

  // Extract text from Word document (.docx)
  app.post("/api/extract-docx", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileBuffer = req.file.buffer;
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      
      res.json({ 
        text: result.value,
        messages: result.messages 
      });
    } catch (error: any) {
      console.error("Word document extraction error:", error.message);
      res.status(500).json({ 
        message: error.message || "Failed to extract text from Word document" 
      });
    }
  });

  app.post("/api/ocr", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { buffer, mimetype, originalname } = req.file;
      
      let text: string;
      let pages = 1;

      if (mimetype === "application/pdf") {
        const result = await extractTextFromPdf(buffer, originalname);
        text = result.text;
        pages = result.pages;
      } else if (
        mimetype === "image/png" ||
        mimetype === "image/jpeg" ||
        mimetype === "image/jpg"
      ) {
        text = await extractTextFromImage(buffer);
      } else if (mimetype === "text/plain") {
        // TXT files - just return the content directly
        text = buffer.toString("utf-8");
      } else if (
        mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        originalname.endsWith(".docx")
      ) {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } else {
        return res.status(400).json({
          message: "Unsupported file type. Please upload PDF, PNG, JPG, TXT, or DOCX files.",
        });
      }

      if (!text || text.length === 0) {
        return res.status(200).json({
          text: "No text could be extracted from this document. The image may not contain readable text or the scan quality may be too low.",
          pages,
        });
      }

      res.json({ text, pages });
    } catch (error: any) {
      console.error("OCR Error:", error.response?.data || error.message);
      res.status(500).json({
        message: error.response?.data?.error?.message || error.message || "Failed to process file",
      });
    }
  });

  return httpServer;
}
