import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import axios from "axios";
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

async function extractTextFromPdf(pdfBuffer: Buffer): Promise<{ text: string; pages: number }> {
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
  });

  const operationLocation = submitResponse.headers["operation-location"];
  if (!operationLocation) {
    throw new Error("Failed to get operation location from Azure");
  }

  const result = await pollForResult(operationLocation);
  return extractTextFromResult(result);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/ocr", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { buffer, mimetype, originalname } = req.file;
      
      let text: string;
      let pages = 1;

      if (mimetype === "application/pdf") {
        const result = await extractTextFromPdf(buffer);
        text = result.text;
        pages = result.pages;
      } else if (
        mimetype === "image/png" ||
        mimetype === "image/jpeg" ||
        mimetype === "image/jpg"
      ) {
        text = await extractTextFromImage(buffer);
      } else {
        return res.status(400).json({
          message: "Unsupported file type. Please upload PDF, PNG, or JPG files.",
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
