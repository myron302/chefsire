/**
 * Migrate existing base64 data URIs in posts, recipes, and stories to
 * on-disk files under /uploads. Idempotent — rows already migrated are skipped.
 *
 * Usage: npm run db:migrate:images
 */
import "dotenv/config";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { db } from "../db";
import { posts, recipes, stories } from "../../shared/schema";
import { sql, like, or } from "drizzle-orm";
import { UPLOADS_DIR } from "../lib/uploads-dir";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

async function saveDataUri(dataUri: string): Promise<{ url: string; bytes: number }> {
  const match = dataUri.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) throw new Error("Invalid data URI format");

  const [, mime, base64] = match;
  const buffer = Buffer.from(base64, "base64");
  const ext = MIME_TO_EXT[mime] ?? "bin";
  const filename = `${randomUUID()}.${ext}`;
  const filepath = path.join(UPLOADS_DIR, filename);

  await fs.writeFile(filepath, buffer);

  return { url: `/uploads/${filename}`, bytes: buffer.length };
}

async function migratePosts() {
  if (!db) throw new Error("Database not configured");

  const rows = await db
    .select({ id: posts.id, imageUrl: posts.imageUrl, additionalImages: posts.additionalImages })
    .from(posts)
    .where(
      or(
        like(posts.imageUrl, "data:%"),
        sql`${posts.additionalImages}::text LIKE '%data:%'`
      )!
    );

  console.log(`[posts] Found ${rows.length} rows with base64 data`);

  for (const row of rows) {
    let changed = false;
    let newImageUrl = row.imageUrl;
    let newAdditionalImages = (row.additionalImages as string[]) ?? [];

    if (row.imageUrl.startsWith("data:")) {
      const { url, bytes } = await saveDataUri(row.imageUrl);
      console.log(`  [posts] id=${row.id} image_url -> ${url} (${(bytes / 1024).toFixed(1)} KB)`);
      newImageUrl = url;
      changed = true;
    }

    const migratedAdditional = await Promise.all(
      newAdditionalImages.map(async (img) => {
        if (!img.startsWith("data:")) return img;
        const { url, bytes } = await saveDataUri(img);
        console.log(`  [posts] id=${row.id} additional_image -> ${url} (${(bytes / 1024).toFixed(1)} KB)`);
        changed = true;
        return url;
      })
    );

    if (changed) {
      await db
        .update(posts)
        .set({
          imageUrl: newImageUrl,
          additionalImages: migratedAdditional,
        })
        .where(sql`${posts.id} = ${row.id}`);
    }
  }
}

async function migrateRecipes() {
  if (!db) throw new Error("Database not configured");

  const rows = await db
    .select({ id: recipes.id, imageUrl: recipes.imageUrl })
    .from(recipes)
    .where(like(recipes.imageUrl!, "data:%"));

  console.log(`[recipes] Found ${rows.length} rows with base64 data`);

  for (const row of rows) {
    if (!row.imageUrl?.startsWith("data:")) continue;
    const { url, bytes } = await saveDataUri(row.imageUrl);
    console.log(`  [recipes] id=${row.id} image_url -> ${url} (${(bytes / 1024).toFixed(1)} KB)`);
    await db
      .update(recipes)
      .set({ imageUrl: url })
      .where(sql`${recipes.id} = ${row.id}`);
  }
}

async function migrateStories() {
  if (!db) throw new Error("Database not configured");

  const rows = await db
    .select({ id: stories.id, imageUrl: stories.imageUrl })
    .from(stories)
    .where(like(stories.imageUrl, "data:%"));

  console.log(`[stories/bites] Found ${rows.length} rows with base64 data`);

  for (const row of rows) {
    if (!row.imageUrl.startsWith("data:")) continue;
    const { url, bytes } = await saveDataUri(row.imageUrl);
    console.log(`  [stories] id=${row.id} image_url -> ${url} (${(bytes / 1024).toFixed(1)} KB)`);
    await db
      .update(stories)
      .set({ imageUrl: url })
      .where(sql`${stories.id} = ${row.id}`);
  }
}

async function main() {
  console.log(`Starting base64 image migration... (writing to ${UPLOADS_DIR})`);

  await migratePosts();
  await migrateRecipes();
  await migrateStories();

  console.log("Migration complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
