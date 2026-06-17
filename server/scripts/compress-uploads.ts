/**
 * Compress legacy oversized JPG/PNG uploads to WebP and update DB references.
 *
 * Usage:
 *   npm run compress:uploads
 *   npm run compress:uploads:dry
 */
import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { sql } from "drizzle-orm";
import { db } from "../db/index";
import { UPLOADS_DIR } from "../lib/uploads-dir";

const MAX_SKIP_BYTES = 300 * 1024;
const LEGACY_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);
const DRY_RUN_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif"]);
const isDryRun = process.argv.includes("--dry-run");

type CompressionResult = {
  oldFilename: string;
  newFilename: string;
  oldUrl: string;
  newUrl: string;
  oldSize: number;
  newSize: number;
};

type DbReferencePreview = {
  label: string;
  references: number;
  rows: number;
  oldUrl: string;
  newUrl: string;
};

type DbReferenceSummary = {
  references: DbReferencePreview[];
  totalReferences: number;
  totalRows: number;
};

type DryRunResult = {
  wouldConvert: boolean;
  skipped: boolean;
  estimatedBytesSaved: number;
  dbRows: number;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function uploadUrl(filename: string): string {
  return `/uploads/${filename}`;
}

function getWebpFilename(filename: string): string {
  return `${path.parse(filename).name}.webp`;
}

function firstRow<T extends Record<string, unknown>>(result: unknown): T {
  if (Array.isArray(result)) return (result[0] ?? {}) as T;
  const rows = (result as { rows?: unknown[] }).rows;
  return (rows?.[0] ?? {}) as T;
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function hasWebpSibling(filename: string): Promise<boolean> {
  const webpPath = path.join(UPLOADS_DIR, getWebpFilename(filename));

  try {
    await fs.access(webpPath);
    return true;
  } catch {
    return false;
  }
}

async function getDatabaseReferenceSummary(oldUrl: string, newUrl: string): Promise<DbReferenceSummary> {
  if (!db) throw new Error("Database not configured (set DATABASE_URL).");

  const postsImage = firstRow<{ rows: unknown }>(
    await db.execute(sql`
      SELECT count(*)::int AS rows
      FROM posts
      WHERE image_url = ${oldUrl}
    `),
  );

  const postsAdditionalImages = firstRow<{ rows: unknown; references: unknown }>(
    await db.execute(sql`
      SELECT
        count(*)::int AS rows,
        COALESCE(
          sum(
            (
              SELECT count(*)
              FROM jsonb_array_elements_text(additional_images) AS images(image_url)
              WHERE image_url = ${oldUrl}
            )
          ),
          0
        )::int AS references
      FROM posts
      WHERE additional_images @> ${JSON.stringify([oldUrl])}::jsonb
    `),
  );

  const recipesImage = firstRow<{ rows: unknown }>(
    await db.execute(sql`
      SELECT count(*)::int AS rows
      FROM recipes
      WHERE image_url = ${oldUrl}
    `),
  );

  const storiesImage = firstRow<{ rows: unknown }>(
    await db.execute(sql`
      SELECT count(*)::int AS rows
      FROM stories
      WHERE image_url = ${oldUrl}
    `),
  );

  const references: DbReferencePreview[] = [
    {
      label: "posts.image_url",
      references: toNumber(postsImage.rows),
      rows: toNumber(postsImage.rows),
      oldUrl,
      newUrl,
    },
    {
      label: "posts.additional_images",
      references: toNumber(postsAdditionalImages.references),
      rows: toNumber(postsAdditionalImages.rows),
      oldUrl,
      newUrl,
    },
    {
      label: "recipes.image_url",
      references: toNumber(recipesImage.rows),
      rows: toNumber(recipesImage.rows),
      oldUrl,
      newUrl,
    },
    {
      label: "stories.image_url",
      references: toNumber(storiesImage.rows),
      rows: toNumber(storiesImage.rows),
      oldUrl,
      newUrl,
    },
  ];

  return {
    references,
    totalReferences: references.reduce((total, reference) => total + reference.references, 0),
    totalRows: references.reduce((total, reference) => total + reference.rows, 0),
  };
}

function formatReferenceList(summary: DbReferenceSummary): string {
  const matchedReferences = summary.references.filter((reference) => reference.references > 0);

  if (matchedReferences.length === 0) return "none";

  return matchedReferences
    .map(
      (reference) =>
        `${reference.label} (${reference.references} reference${reference.references === 1 ? "" : "s"}, ${reference.rows} row${reference.rows === 1 ? "" : "s"}): ${reference.oldUrl} -> ${reference.newUrl}`,
    )
    .join("; ");
}

async function estimateWebpSize(filename: string): Promise<number> {
  const oldPath = path.join(UPLOADS_DIR, filename);
  const buffer = await sharp(oldPath)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  return buffer.length;
}

async function updateDatabaseReferences(oldUrl: string, newUrl: string): Promise<void> {
  if (!db) throw new Error("Database not configured (set DATABASE_URL).");

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE posts
      SET image_url = ${newUrl}
      WHERE image_url = ${oldUrl}
    `);

    await tx.execute(sql`
      UPDATE posts
      SET additional_images = COALESCE(
        (
          SELECT jsonb_agg(
            CASE
              WHEN image_url = ${oldUrl} THEN to_jsonb(${newUrl}::text)
              ELSE to_jsonb(image_url)
            END
            ORDER BY image_position
          )
          FROM jsonb_array_elements_text(additional_images) WITH ORDINALITY AS images(image_url, image_position)
        ),
        '[]'::jsonb
      )
      WHERE additional_images @> ${JSON.stringify([oldUrl])}::jsonb
    `);

    await tx.execute(sql`
      UPDATE recipes
      SET image_url = ${newUrl}
      WHERE image_url = ${oldUrl}
    `);

    await tx.execute(sql`
      UPDATE stories
      SET image_url = ${newUrl}
      WHERE image_url = ${oldUrl}
    `);
  });
}

async function dryRunUpload(filename: string): Promise<DryRunResult> {
  const oldPath = path.join(UPLOADS_DIR, filename);
  const extension = path.extname(filename).toLowerCase();
  const oldStats = await fs.stat(oldPath);

  if (extension === ".gif") {
    console.log(`[DRY RUN][skip] ${filename} (GIFs are left untouched to preserve animation)`);
    return { wouldConvert: false, skipped: true, estimatedBytesSaved: 0, dbRows: 0 };
  }

  if (oldStats.size < MAX_SKIP_BYTES) {
    console.log(`[DRY RUN][skip] ${filename} (under 300KB: ${formatBytes(oldStats.size)})`);
    return { wouldConvert: false, skipped: true, estimatedBytesSaved: 0, dbRows: 0 };
  }

  const newFilename = getWebpFilename(filename);

  if (await hasWebpSibling(filename)) {
    console.log(`[DRY RUN][skip] ${filename} (already has .webp sibling: ${newFilename})`);
    return { wouldConvert: false, skipped: true, estimatedBytesSaved: 0, dbRows: 0 };
  }

  const oldUrl = uploadUrl(filename);
  const newUrl = uploadUrl(newFilename);
  const estimatedNewSize = await estimateWebpSize(filename);
  const dbReferences = await getDatabaseReferenceSummary(oldUrl, newUrl);
  const estimatedBytesSaved = Math.max(0, oldStats.size - estimatedNewSize);

  console.log(
    `[DRY RUN] ${filename} (${formatBytes(oldStats.size)}) -> would write ${newFilename} (${formatBytes(
      estimatedNewSize,
    )}), would update ${dbReferences.totalReferences} DB reference${
      dbReferences.totalReferences === 1 ? "" : "s"
    }: ${formatReferenceList(dbReferences)}`,
  );

  return {
    wouldConvert: true,
    skipped: false,
    estimatedBytesSaved,
    dbRows: dbReferences.totalRows,
  };
}

async function compressUpload(filename: string): Promise<CompressionResult | null> {
  const oldPath = path.join(UPLOADS_DIR, filename);
  const newFilename = getWebpFilename(filename);
  const newPath = path.join(UPLOADS_DIR, newFilename);
  const oldUrl = uploadUrl(filename);
  const newUrl = uploadUrl(newFilename);
  const oldStats = await fs.stat(oldPath);

  if (oldStats.size < MAX_SKIP_BYTES) {
    console.log(`[skip:small] ${filename} (${formatBytes(oldStats.size)})`);
    return null;
  }

  if (await hasWebpSibling(filename)) {
    console.log(`[skip:webp-exists] ${filename} -> ${newFilename}`);
    return null;
  }

  await sharp(oldPath)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(newPath);

  const newStats = await fs.stat(newPath);

  try {
    await updateDatabaseReferences(oldUrl, newUrl);
    await fs.unlink(oldPath);
  } catch (error) {
    await fs.rm(newPath, { force: true });
    throw error;
  }

  console.log(
    `[compressed] ${filename}: ${formatBytes(oldStats.size)} -> ${formatBytes(newStats.size)} (${newFilename})`,
  );

  return {
    oldFilename: filename,
    newFilename,
    oldUrl,
    newUrl,
    oldSize: oldStats.size,
    newSize: newStats.size,
  };
}

async function main(): Promise<void> {
  if (!db) throw new Error("Database not configured (set DATABASE_URL).");

  console.log(`Scanning uploads directory: ${UPLOADS_DIR}${isDryRun ? " [DRY RUN]" : ""}`);

  const entries = await fs.readdir(UPLOADS_DIR, { withFileTypes: true });
  const extensionsToScan = isDryRun ? DRY_RUN_IMAGE_EXTENSIONS : LEGACY_IMAGE_EXTENSIONS;
  const candidates = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((filename) => extensionsToScan.has(path.extname(filename).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  console.log(
    `Found ${candidates.length} ${isDryRun ? "JPG/PNG/GIF upload file" : "JPG/PNG upload candidate"}${
      candidates.length === 1 ? "" : "s"
    }.`,
  );

  if (isDryRun) {
    let wouldConvertCount = 0;
    let skippedCount = 0;
    let estimatedBytesSaved = 0;
    let totalDbRows = 0;

    for (const filename of candidates) {
      const result = await dryRunUpload(filename);
      if (result.wouldConvert) wouldConvertCount += 1;
      if (result.skipped) skippedCount += 1;
      estimatedBytesSaved += result.estimatedBytesSaved;
      totalDbRows += result.dbRows;
    }

    console.log(
      `[DRY RUN] Summary: ${wouldConvertCount} file${wouldConvertCount === 1 ? "" : "s"} would be converted; ${
        skippedCount
      } skipped; estimated total bytes saved: ${formatBytes(
        estimatedBytesSaved,
      )}; total DB rows that would be updated: ${totalDbRows}.`,
    );
    return;
  }

  let compressedCount = 0;
  let totalBytesSaved = 0;

  for (const filename of candidates) {
    const result = await compressUpload(filename);
    if (!result) continue;

    compressedCount += 1;
    totalBytesSaved += Math.max(0, result.oldSize - result.newSize);
  }

  console.log(
    `Compression complete. Compressed ${compressedCount} file(s); total bytes saved: ${formatBytes(totalBytesSaved)}.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Upload compression failed:", error);
    process.exit(1);
  });
