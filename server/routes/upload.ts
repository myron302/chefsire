import { Router } from "express";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { requireAuth } from "../middleware";
import fs from "fs";
import sharp from "sharp";

const router = Router();

// Configure multer for general file uploads (disk storage)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');

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
  }
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

      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const host = req.get('x-forwarded-host') || req.get('host');

      // GIFs are saved as-is to preserve animation
      if (req.file.mimetype === 'image/gif') {
        const filename = `${randomUUID()}.gif`;
        const filepath = path.join(uploadsDir, filename);
        fs.writeFileSync(filepath, req.file.buffer);
        const url = `${protocol}://${host}/uploads/${filename}`;
        return res.json({ ok: true, url, thumbUrl: url });
      }

      const uuid = randomUUID();
      const mainFilename = `${uuid}.webp`;
      const thumbFilename = `${uuid}_thumb.webp`;
      const mainPath = path.join(uploadsDir, mainFilename);
      const thumbPath = path.join(uploadsDir, thumbFilename);

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

      const url = `${protocol}://${host}/uploads/${mainFilename}`;
      const thumbUrl = `${protocol}://${host}/uploads/${thumbFilename}`;

      res.json({ ok: true, url, thumbUrl });
    } catch (error: any) {
      console.error("Error processing image upload:", error);
      res.status(500).json({ ok: false, error: error.message || "Failed to process image" });
    }
  });
});

export default router;
