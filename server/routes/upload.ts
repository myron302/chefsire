import { Router } from "express";
import multer from "multer";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { requireAuth } from "../middleware";
import fs from "fs";
import { UPLOADS_DIR, uploadUrlPath } from "../lib/uploads-dir";
import { isR2Configured, publicUrl, uploadFileToR2, uploadToR2 } from "../lib/r2";
import { imageUpload, storeUploadedImage } from "../services/image-upload";

const router = Router();

const GENERAL_UPLOAD_LIMIT_BYTES = 100 * 1024 * 1024; // 100MB

const allowedGeneralUploadTypes = [
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

function generalUploadFileFilter(_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (allowedGeneralUploadTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, Excel, videos, images, and ZIP files are allowed.'));
  }
}

// Configure multer for general local file uploads (disk storage → UPLOADS_DIR)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const localUpload = multer({
  storage,
  limits: {
    fileSize: GENERAL_UPLOAD_LIMIT_BYTES,
  },
  fileFilter: generalUploadFileFilter,
});

const r2TempUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, os.tmpdir());
    },
    filename: (_req, file, cb) => {
      cb(null, `chefsire-upload-${randomUUID()}${path.extname(file.originalname)}`);
    },
  }),
  limits: {
    fileSize: GENERAL_UPLOAD_LIMIT_BYTES,
  },
  fileFilter: generalUploadFileFilter,
});

function tempUploadPath(file?: Express.Multer.File): string | undefined {
  return file && 'path' in file ? file.path : undefined;
}

async function cleanupTempUpload(file?: Express.Multer.File) {
  const filePath = tempUploadPath(file);
  if (!filePath) return;

  try {
    await fs.promises.unlink(filePath);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      console.warn("Failed to delete temp upload:", error);
    }
  }
}

function extensionForUpload(file: Express.Multer.File): string {
  const ext = path.extname(file.originalname);
  if (ext) return ext.toLowerCase();

  const mimeExt: Record<string, string> = {
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/x-msvideo": ".avi",
    "video/webm": ".webm",
    "video/ogg": ".ogg",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
    "application/zip": ".zip",
    "application/epub+zip": ".epub",
  };

  return mimeExt[file.mimetype] || "";
}

// POST /api/upload - General file upload (videos, docs, etc.)
router.post("/", requireAuth, (req, res) => {
  const usingR2 = isR2Configured();
  const middleware = usingR2 ? r2TempUpload : localUpload;
  middleware.single('file')(req, res, async (err) => {
    if (err) {
      if (usingR2) {
        await cleanupTempUpload(req.file);
      }

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

      let fileUrl: string;

      if (usingR2) {
        const key = `posts/${randomUUID()}${extensionForUpload(req.file)}`;
        await uploadFileToR2(key, req.file.path, req.file.mimetype);
        fileUrl = publicUrl(key);
      } else {
        fileUrl = uploadUrlPath(req.file.filename);
      }

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
    } finally {
      if (usingR2) {
        await cleanupTempUpload(req.file);
      }
    }
  });
});

// Memory-storage multer for image processing (25MB limit, images only)
// POST /api/upload/image - Compressed image upload with thumbnail
router.post("/image", requireAuth, (req, res) => {
  imageUpload.single('file')(req, res, async (err) => {
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

      res.json({ ok: true, ...await storeUploadedImage(req.file) });
    } catch (error: any) {
      console.error("Error processing image upload:", error);
      res.status(500).json({ ok: false, error: error.message || "Failed to process image" });
    }
  });
});

export default router;
