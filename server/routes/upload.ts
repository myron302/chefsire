import { Router } from "express";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { requireAuth } from "../middleware";
import fs from "fs";
import sharp from "sharp";
import { UPLOADS_DIR, uploadUrlPath } from "../lib/uploads-dir";

const router = Router();

// Configure multer for general file uploads (disk storage → UPLOADS_DIR)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
      'video/ogg',
      'application/zip',
      'application/epub+zip',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, Excel, videos, images, and ZIP files are allowed.'));
    }
  },
});

// POST /api/upload - General file upload (videos, docs, etc.)
router.post("/", requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error("Upload error:", err);

      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ ok: false, error: "File is too large. Maximum size is 100MB." });
        }
        return res.status(400).json({ ok: false, error: `Upload error: ${err.message}` });
      }

      return res.status(400).json({ ok: false, error: err.message || "Invalid file type" });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ ok: false, error: "No file uploaded" });
      }

      const fileUrl = uploadUrlPath(req.file.filename);

      res.json({
        ok: true,
        url: fileUrl,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
      });
    } catch (error: any) {
      console.error("Error processing upload:", error);
      res.status(500).json({ ok: false, error: error.message || "Failed to process upload" });
    }
  });
});

// Memory-storage multer for image processing (25MB limit, images only)
const imageMemoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are accepted.'));
    }
  },
});

// POST /api/upload/image - Compressed image upload with thumbnail
router.post("/image", requireAuth, (req, res) => {
  imageMemoryUpload.single('file')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ ok: false, error: "Image is too large. Maximum size is 25MB." });
      }
      return res.status(400).json({ ok: false, error: err.message || "Invalid image" });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ ok: false, error: "No file uploaded" });
      }

      // GIFs are saved as-is to preserve animation
      if (req.file.mimetype === 'image/gif') {
        const filename = `${randomUUID()}.gif`;
        fs.writeFileSync(path.join(UPLOADS_DIR, filename), req.file.buffer);
        const url = uploadUrlPath(filename);
        return res.json({ ok: true, url, thumbUrl: url });
      }

      const uuid = randomUUID();
      const mainFilename = `${uuid}.webp`;
      const thumbFilename = `${uuid}_thumb.webp`;
      const mainPath = path.join(UPLOADS_DIR, mainFilename);
      const thumbPath = path.join(UPLOADS_DIR, thumbFilename);

      await sharp(req.file.buffer)
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(mainPath);

      await sharp(req.file.buffer)
        .rotate()
        .resize({ width: 480, withoutEnlargement: true })
        .webp({ quality: 75 })
        .toFile(thumbPath);

      const url = uploadUrlPath(mainFilename);
      const thumbUrl = uploadUrlPath(thumbFilename);

      res.json({ ok: true, url, thumbUrl });
    } catch (error: any) {
      console.error("Error processing image upload:", error);
      res.status(500).json({ ok: false, error: error.message || "Failed to process image" });
    }
  });
});

export default router;
