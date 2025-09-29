import { Router } from "express";
import multer from "multer";
import { ImageAnnotatorClient } from "@google-cloud/vision";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/ocr/receipt
 * multipart/form-data with field "file"
 * returns: { text: string }
 */
router.post("/receipt", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded (field name must be 'file')." });
    }

    // Google Cloud Vision client (uses GOOGLE_APPLICATION_CREDENTIALS or ADC)
    const client = new ImageAnnotatorClient();

    // Vision API can accept Buffer
    const [result] = await client.textDetection({
      image: { content: req.file.buffer },
    });

    const text = result?.fullTextAnnotation?.text || result?.textAnnotations?.[0]?.description || "";

    return res.json({ text });
  } catch (err: any) {
    console.error("OCR error:", err?.message || err);
    return res.status(500).json({ error: "OCR failed" });
  }
});

export default router;
