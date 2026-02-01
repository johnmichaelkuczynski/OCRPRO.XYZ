import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import axios from "axios";
import Stripe from "stripe";
import mammoth from "mammoth";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { db } from "./db";
import { payments } from "@shared/schema";
import { eq, and, gt } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-12-15.clover",
});

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

// Helper function to check if user has valid access
async function hasValidAccess(userId: string): Promise<boolean> {
  const now = new Date();
  const validPayments = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.userId, userId),
        gt(payments.expiresAt, now)
      )
    )
    .limit(1);
  
  return validPayments.length > 0;
}

// Get access expiry for a user
async function getAccessExpiry(userId: string): Promise<Date | null> {
  const now = new Date();
  const validPayments = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.userId, userId),
        gt(payments.expiresAt, now)
      )
    )
    .limit(1);
  
  return validPayments.length > 0 ? validPayments[0].expiresAt : null;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication (must be before other routes)
  await setupAuth(app);
  registerAuthRoutes(app);

  // Check user's access status
  app.get("/api/access-status", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const userId = (req.user as any).id;
    const expiresAt = await getAccessExpiry(userId);
    
    res.json({
      hasAccess: expiresAt !== null,
      expiresAt: expiresAt?.toISOString() || null,
    });
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

  // Create Stripe checkout session
  app.post("/api/create-checkout-session", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = req.user as any;
    const priceId = process.env.STRIPE_PRICE_ID;
    
    if (!priceId) {
      return res.status(500).json({ message: "Stripe price ID not configured" });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${req.headers.origin || "https://ocrpro.xyz"}?payment=success`,
        cancel_url: `${req.headers.origin || "https://ocrpro.xyz"}?payment=cancelled`,
        customer_email: user.email,
        metadata: {
          userId: user.id,
        },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe error:", error.message);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  // Stripe webhook handler
  app.post("/api/stripe-webhook", async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return res.status(400).json({ message: "Missing signature or webhook secret" });
    }

    let event: Stripe.Event;

    try {
      // Use rawBody stored by express.json verify function
      const rawBody = (req as any).rawBody;
      if (!rawBody) {
        throw new Error("Raw body not available");
      }
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).json({ message: `Webhook Error: ${err.message}` });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;

      if (userId) {
        // Check if this session was already processed (idempotent)
        const existingPayment = await db
          .select()
          .from(payments)
          .where(eq(payments.stripeSessionId, session.id))
          .limit(1);

        if (existingPayment.length === 0) {
          // Grant 1 day access
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 1);

          await db.insert(payments).values({
            userId,
            stripeSessionId: session.id,
            stripeCustomerId: session.customer as string || null,
            expiresAt,
          });

          console.log(`Access granted to user ${userId} until ${expiresAt.toISOString()}`);
        } else {
          console.log(`Payment already processed for session ${session.id}`);
        }
      }
    }

    res.json({ received: true });
  });

  app.post("/api/ocr", upload.single("file"), async (req, res) => {
    // Check access - if logged in, verify payment; if not logged in, allow upload anyway for testing
    if (req.isAuthenticated() && req.user) {
      const userId = (req.user as any).id;
      const hasAccess = await hasValidAccess(userId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Please purchase access to use the OCR feature" });
      }
    }
    // Allow uploads without login for now
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
      } else if (mimetype === "text/plain") {
        // TXT files - just return the content directly
        text = buffer.toString("utf-8");
      } else {
        return res.status(400).json({
          message: "Unsupported file type. Please upload PDF, PNG, JPG, or TXT files.",
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
