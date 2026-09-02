import fs from "fs";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

const requiredEnvVars = [
  "R2_ENDPOINT",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_BASE_URL",
] as const;

export function isR2Configured(): boolean {
  return requiredEnvVars.every((name) => Boolean(process.env[name]?.trim()));
}

export const r2Client = new S3Client({
  region: process.env.R2_REGION || "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: true,
});

function r2Bucket(): string {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) {
    throw new Error("R2_BUCKET is required to upload media");
  }

  return bucket;
}

export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<string> {
  await r2Client.send(new PutObjectCommand({
    Bucket: r2Bucket(),
    Key: key,
    Body: body,
    ContentType: contentType,
  }));

  return key;
}

export async function uploadFileToR2(key: string, filePath: string, contentType: string): Promise<string> {
  const upload = new Upload({
    client: r2Client,
    params: {
      Bucket: r2Bucket(),
      Key: key,
      Body: fs.createReadStream(filePath),
      ContentType: contentType,
    },
  });

  await upload.done();

  return key;
}

export function publicUrl(key: string): string {
  const baseUrl = process.env.R2_PUBLIC_BASE_URL;
  if (!baseUrl) {
    throw new Error("R2_PUBLIC_BASE_URL is required to build media URLs");
  }

  return `${baseUrl.replace(/\/$/, "")}/${key}`;
}

/**
 * Private-object helpers, added for booking documents. They deliberately share this module's single S3 client and
 * credentials rather than starting a second R2 stack, but they never touch R2_PUBLIC_BASE_URL and never build a URL:
 * there is no public address for an object written through these helpers.
 *
 * They also use their own bucket. The bucket behind R2_BUCKET is the public media bucket -- R2_PUBLIC_BASE_URL exists
 * precisely so its objects can be served directly -- so writing a booking document there and calling it private would
 * not be true. R2_PRIVATE_BUCKET must therefore name a bucket with no public access binding, and it may not be the
 * public bucket itself: that collision throws rather than being tolerated. When R2_PRIVATE_BUCKET is simply absent,
 * `isPrivateR2Configured()` is false and callers fall back to private local storage -- an unconfigured deployment and
 * an unsafely configured one are deliberately different outcomes.
 */
export function isPrivateR2Configured(): boolean {
  const names = ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PRIVATE_BUCKET"] as const;
  return names.every((name) => Boolean(process.env[name]?.trim()));
}

/**
 * Bucket names are compared trimmed and case-folded. R2 and S3 bucket names are lowercase by specification, so a
 * spelling that differs only in case or surrounding whitespace names the same bucket -- it must not be able to slip
 * past this check and land booking documents in the publicly addressable bucket.
 */
function normalizeBucketName(bucket: string | undefined): string {
  return (bucket ?? "").trim().toLowerCase();
}

export type PrivateBucketConflict = "same_as_public";
/**
 * Whether the configured private bucket is unusable, or null when it is safe.
 *
 * Only one conflict exists and it is decisive: a private bucket equal to R2_BUCKET is the bucket R2_PUBLIC_BASE_URL
 * exists to serve, so every "private" booking document written there would be publicly addressable. A private
 * bucket that is simply absent is NOT a conflict -- that is the legitimate local-fallback deployment.
 */
export function privateBucketConflict(privateBucket: string | undefined, publicBucket: string | undefined): PrivateBucketConflict | null {
  const privateName = normalizeBucketName(privateBucket);
  const publicName = normalizeBucketName(publicBucket);
  if (privateName === "" || publicName === "") return null;
  return privateName === publicName ? "same_as_public" : null;
}

/**
 * Fails closed on a private bucket that collides with the public one.
 *
 * This is a configuration error, not something to route around: silently reporting private R2 as unavailable and
 * falling back to local storage would leave an administrator believing their configured bucket is in use, while
 * quietly changing where booking documents live. Neither bucket name is a secret, and naming them is what makes the
 * misconfiguration fixable; no credential or endpoint is included.
 */
export function assertPrivateBucketIsolated(privateBucket: string | undefined, publicBucket: string | undefined): void {
  if (!privateBucketConflict(privateBucket, publicBucket)) return;
  throw new Error(
    "R2_PRIVATE_BUCKET must be a distinct non-public bucket and cannot equal R2_BUCKET. " +
    "R2_BUCKET is served publicly through R2_PUBLIC_BASE_URL, so private catering booking documents written there " +
    `would be publicly addressable. Both are currently set to "${normalizeBucketName(privateBucket)}". ` +
    "Create a separate R2 bucket with no public access binding and point R2_PRIVATE_BUCKET at it.",
  );
}

/** Reads the two bucket names from the environment and fails closed on a collision. */
export function assertPrivateR2Isolated(): void {
  assertPrivateBucketIsolated(process.env.R2_PRIVATE_BUCKET, process.env.R2_BUCKET);
}

/**
 * The single chokepoint every private R2 operation resolves its bucket through, so the collision check cannot be
 * bypassed by calling a put/get/head/delete helper directly.
 */
function privateBucket(): string {
  const bucket = process.env.R2_PRIVATE_BUCKET?.trim();
  if (!bucket) throw new Error("R2_PRIVATE_BUCKET is required to store private booking documents");
  assertPrivateR2Isolated();
  return bucket;
}

export async function putPrivateObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await r2Client.send(new PutObjectCommand({ Bucket: privateBucket(), Key: key, Body: body, ContentType: contentType }));
}

/** Reads the whole object into memory. Booking documents are capped well below any streaming threshold. */
export async function getPrivateObject(key: string): Promise<Buffer> {
  const result = await r2Client.send(new GetObjectCommand({ Bucket: privateBucket(), Key: key }));
  const body = result.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined;
  if (!body?.transformToByteArray) throw new Error("Private object body was not readable");
  return Buffer.from(await body.transformToByteArray());
}

export async function headPrivateObject(key: string): Promise<{ byteSize: number } | null> {
  try {
    const result = await r2Client.send(new HeadObjectCommand({ Bucket: privateBucket(), Key: key }));
    return { byteSize: Number(result.ContentLength ?? 0) };
  } catch {
    return null;
  }
}

export async function deletePrivateObject(key: string): Promise<void> {
  await r2Client.send(new DeleteObjectCommand({ Bucket: privateBucket(), Key: key }));
}
