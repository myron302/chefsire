import { Router } from "express";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { requireAuth } from "../middleware";
import fs from "fs";

const router = Router();

// POST /api/upload - Upload a file
router.post("/", requireAuth, async (req, res) => {
  try {
    // Configure multer for file uploads (lazy initialization)
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads');

        // Create uploads directory if it doesn't exist
        try {
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, uploadDir);
        } catch (error) {
          console.error('[upload] Failed to create uploads directory:', error);
          cb(error as Error, uploadDir);
        }
      },
      filename: (req, file, cb) => {
        const uniqueName = `${randomUUID()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
      }
    });

    const upload = multer({
      storage,
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
      },
      fileFilter: (req, file, cb) => {
        // Allow specific file types
        const allowedTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'video/mp4',
          'video/quicktime',
          'video/x-msvideo',
          'application/zip',
          'application/epub+zip',
          'image/jpeg',
          'image/png',
          'image/gif'
        ];

        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only PDF, DOC, Excel, videos, images, and ZIP files are allowed.'));
        }
      }
    });

    // Use multer middleware
    const uploadSingle = upload.single('file');

    uploadSingle(req, res, (err) => {
      if (err) {
        console.error("Error uploading file:", err);
        return res.status(500).json({ ok: false, error: err.message || "Failed to upload file" });
      }

      if (!req.file) {
        return res.status(400).json({ ok: false, error: "No file uploaded" });
      }

      // Generate URL for the uploaded file
      const fileUrl = `/uploads/${req.file.filename}`;

      res.json({
        ok: true,
        url: fileUrl,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    });
  } catch (error: any) {
    console.error("Error in upload handler:", error);
    res.status(500).json({ ok: false, error: error.message || "Failed to upload file" });
  }
});

export default router;
