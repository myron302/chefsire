import { Router } from "express";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { requireAuth } from "../middleware";
import fs from "fs";

const router = Router();

// Configure multer for file uploads
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
      console.error('[UPLOAD] Failed to create uploads directory:', error);
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

// POST /api/upload - Upload a file
router.post("/", requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error("Upload error:", err);

      // Handle Multer errors specifically
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ ok: false, error: "File is too large. Maximum size is 100MB." });
        }
        return res.status(400).json({ ok: false, error: `Upload error: ${err.message}` });
      }

      // Handle file filter errors
      return res.status(400).json({ ok: false, error: err.message || "Invalid file type" });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ ok: false, error: "No file uploaded" });
      }

      // Generate full URL for the uploaded file
      // Check for forwarded headers (when behind proxy like Plesk)
      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const host = req.get('x-forwarded-host') || req.get('host');
      const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

      res.json({
        ok: true,
        url: fileUrl,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    } catch (error: any) {
      console.error("Error processing upload:", error);
      res.status(500).json({ ok: false, error: error.message || "Failed to process upload" });
    }
  });
});

// DELETE /api/upload/:filename - Delete uploaded file
router.delete("/:filename", requireAuth, async (req, res) => {
  try {
    const { filename } = req.params;

    // Security: Validate filename to prevent path traversal
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ ok: false, error: "Invalid filename" });
    }

    // Build the file path and ensure it's under uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadsDir, filename);

    // Verify the resolved path is still under uploads directory
    const resolvedPath = path.resolve(filePath);
    const resolvedUploadsDir = path.resolve(uploadsDir);
    
    if (!resolvedPath.startsWith(resolvedUploadsDir)) {
      console.error('[UPLOAD DELETE] Path traversal attempt:', filename);
      return res.status(403).json({ ok: false, error: "Access denied" });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ ok: false, error: "File not found" });
    }

    // Delete the file
    fs.unlinkSync(filePath);
    console.log('[UPLOAD DELETE] Successfully deleted file:', filename);

    res.json({ ok: true, message: "File deleted successfully" });
  } catch (error: any) {
    console.error('[UPLOAD DELETE] Error deleting file:', error);
    res.status(500).json({ ok: false, error: error.message || "Failed to delete file" });
  }
});

export default router;
