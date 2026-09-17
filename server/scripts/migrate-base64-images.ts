/**
 * Migrate existing base64 data URIs in posts, recipes, and stories to
 * on-disk files under /uploads. Idempotent — rows already migrated are skipped.
 *
 * Usage: npm run db:migrate:images
 */
import "dotenv/config";
import path from "path";
import fs from "fs/promises";
import { db } from "../db";
import { posts, recipes, stories } from "../../shared/schema";
import { sql, like, or } from "drizzle-orm";
import { UPLOADS_DIR } from "../lib/uploads-dir";
import { generatedMediaName, validateUploadedMedia } from "../services/media-validation";

/**
 * The base64 this migration moves out of the database was supplied by users, so it crosses the same trust
 * boundary an upload does and goes through the same validator.
 *
 * It used to pick the extension from the data URI's own declared media type through a table that mapped
 * `"image/svg+xml"` to `"svg"`, writing attacker-chosen active content into the directory served at `/uploads`
 * with an extension that made it a document on ChefSire's origin. The bytes now decide, and a row whose payload
 * is not media ChefSire accepts is left in place and reported rather than written out.
 */
async function saveDataUri(dataUri: string): Promise<{ url: string; bytes: number } | null> {
  const match = dataUri.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) throw new Error("Invalid data URI format");

  const [, , base64] = match;
  const buffer = Buffer.from(base64, "base64");

  const validated = await validateUploadedMedia({ source: { buffer }, allow: ["image", "video"] });
  if (validated.kind === "rejected") {
    // Reported and left in place rather than thrown: one unacceptable row must not abort a migration whose
    // whole point is that it can be re-run, and the operator needs to know which rows were not moved.
    console.warn(`  [skip] payload is not accepted media (${validated.reason}); the row is left unchanged`);
    return null;
  }

  const filename = generatedMediaName(validated.extension);
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
      const saved = await saveDataUri(row.imageUrl);
      if (saved) {
        console.log(`  [posts] id=${row.id} image_url -> ${saved.url} (${(saved.bytes / 1024).toFixed(1)} KB)`);
        newImageUrl = saved.url;
        changed = true;
      }
    }

    const migratedAdditional = await Promise.all(
      newAdditionalImages.map(async (img) => {
        if (!img.startsWith("data:")) return img;
        const saved = await saveDataUri(img);
        if (!saved) return img;
        console.log(`  [posts] id=${row.id} additional_image -> ${saved.url} (${(saved.bytes / 1024).toFixed(1)} KB)`);
        changed = true;
        return saved.url;
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
    const saved = await saveDataUri(row.imageUrl);
    if (!saved) continue;
    console.log(`  [recipes] id=${row.id} image_url -> ${saved.url} (${(saved.bytes / 1024).toFixed(1)} KB)`);
    await db
      .update(recipes)
      .set({ imageUrl: saved.url })
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
    const saved = await saveDataUri(row.imageUrl);
    if (!saved) continue;
    console.log(`  [stories] id=${row.id} image_url -> ${saved.url} (${(saved.bytes / 1024).toFixed(1)} KB)`);
    await db
      .update(stories)
      .set({ imageUrl: saved.url })
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
