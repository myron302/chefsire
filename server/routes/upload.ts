/**
 * The general upload route, and the one place a large file (a post video, a marketplace digital product) crosses
 * ChefSire's trust boundary.
 *
 * THE SHAPE THIS ROUTE NOW HAS. Multer writes the request body to a STAGING directory that nothing serves, under a
 * name with no extension at all. Only after the file's own bytes have been classified is it promoted: to R2 under
 * a generated key with the verified content type, or into `UPLOADS_DIR` under a generated name. A file that fails
 * validation is unlinked from staging and never existed anywhere durable or public.
 *
 * WHAT IT REPLACES. The disk-storage path wrote straight into `UPLOADS_DIR` -- the directory `express.static`
 * serves at `/uploads` -- under `${randomUUID()}${path.extname(file.originalname)}`. The uploader chose the
 * extension and, through `file.mimetype`, chose whether the upload was allowed at all. HTML bytes declared
 * `image/jpeg` and named `attack.html` landed as `<uuid>.html` and came back as `text/html` on ChefSire's origin.
 */
import { Router } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { requireAuth } from "../middleware";
import fs from "fs";
import { MEDIA_REJECTION_MESSAGES, MEDIA_REJECTION_STATUS } from "@shared/media-types";
import { uploadUrlPath } from "../lib/uploads-dir";
import { isR2Configured, publicUrl, uploadFileToR2 } from "../lib/r2";
import { UnsupportedMediaError, imageUpload, storeUploadedImage } from "../services/image-upload";
import { generatedMediaKey, generatedMediaName, validateUploadedMedia } from "../services/media-validation";
import { UPLOAD_STAGING_DIR, ensureUploadDirectories, promoteToUploadsDir } from "../services/upload-staging";

const router = Router();

export const GENERAL_UPLOAD_LIMIT_BYTES = 100 * 1024 * 1024; // 100MB

// Where an upload lives while it is still untrusted, and how a validated one is published atomically. Both
// directories and the reasoning behind them live in services/upload-staging.
ensureUploadDirectories();

/**
 * A cheap pre-filter, and explicitly NOT the security decision.
 *
 * The declared MIME is copied out of the multipart part header by the client, so all this can do is avoid
 * spooling 100MB of something that could never be accepted. `validateUploadedMedia` decides what the file is.
 */
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

/**
 * One staging parser for both destinations.
 *
 * The staged name carries NO extension: there is nothing to derive one from yet, and a name without an extension
 * cannot be mistaken for a served object if it is ever left behind. R2 and local storage now receive exactly the
 * same already-validated bytes under exactly the same generated names, so a deployment that falls back from R2 to
 * local storage does not fall back to a weaker rule.
 */
const stagingUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, UPLOAD_STAGING_DIR);
    },
    filename: (_req, _file, cb) => {
      cb(null, `chefsire-upload-${randomUUID()}`);
    },
  }),
  limits: {
    fileSize: GENERAL_UPLOAD_LIMIT_BYTES,
    files: 1,
  },
  fileFilter: generalUploadFileFilter,
});

function stagedPath(file?: Express.Multer.File): string | undefined {
  return file && 'path' in file ? file.path : undefined;
}

async function discardStagedUpload(file?: Express.Multer.File) {
  const filePath = stagedPath(file);
  if (!filePath) return;

  try {
    await fs.promises.unlink(filePath);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      console.warn("Failed to delete staged upload:", error);
    }
  }
}

/** Display metadata only. It is echoed back to the uploader and never touches a path, a key or a header. */
function displayFilename(originalName: string): string {
  const lastSegment = (originalName ?? "").split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  return lastSegment.replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, 200) || "upload";
}

// POST /api/upload - General file upload (videos, documents, images)
router.post("/", requireAuth, (req, res) => {
  stagingUpload.single('file')(req, res, async (err) => {
    if (err) {
      await discardStagedUpload(req.file);

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
      const staged = stagedPath(req.file);
      if (!staged) {
        return res.status(400).json({ ok: false, error: "No file uploaded" });
      }

      // Nothing has been stored yet. This is what decides whether anything ever will be.
      const validated = await validateUploadedMedia({
        source: { path: staged, byteSize: req.file.size },
        allow: ["image", "video", "document"],
        declaredMimeType: req.file.mimetype,
        originalName: req.file.originalname,
        maxBytes: GENERAL_UPLOAD_LIMIT_BYTES,
      });
      if (validated.kind === "rejected") {
        return res.status(MEDIA_REJECTION_STATUS[validated.reason]).json({ ok: false, error: MEDIA_REJECTION_MESSAGES[validated.reason] });
      }

      let fileUrl: string;

      if (isR2Configured()) {
        const key = generatedMediaKey("posts", validated.extension);
        // The content type R2 stores, and therefore the one a browser is handed, is the verified one.
        await uploadFileToR2(key, staged, validated.contentType);
        fileUrl = publicUrl(key);
      } else {
        const filename = generatedMediaName(validated.extension);
        await promoteToUploadsDir(staged, filename);
        fileUrl = uploadUrlPath(filename);
      }

      res.json({
        ok: true,
        url: fileUrl,
        filename: displayFilename(req.file.originalname),
        size: req.file.size,
        // The verified type, not the declared one. A client that echoes this is echoing the server's finding.
        mimetype: validated.contentType,
      });
    } catch (error: any) {
      console.error("Error processing upload:", error);
      res.status(500).json({ ok: false, error: "Failed to process upload" });
    } finally {
      // A promoted local file has already been renamed out of staging; this removes anything still there --
      // the R2 copy's source, and every rejected or failed upload.
      await discardStagedUpload(req.file);
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
      if (error instanceof UnsupportedMediaError) {
        return res.status(error.status).json({ ok: false, error: error.message });
      }
      console.error("Error processing image upload:", error);
      res.status(500).json({ ok: false, error: "Failed to process image" });
    }
  });
});

export default router;
