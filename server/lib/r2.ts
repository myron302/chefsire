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
 * public bucket itself: that collision throws rather than being tolerated.
 *
 * DEPLOYMENT RULE. Private R2 configuration has exactly three states, and the difference between the last two is
 * the point:
 *
 *   R2_PRIVATE_BUCKET absent  -> private R2 is intentionally not configured; local private storage is used. This is
 *                                the supported development and single-instance deployment.
 *   R2_PRIVATE_BUCKET set, and every connection variable set -> private R2 is used.
 *   R2_PRIVATE_BUCKET set, but a connection variable missing or blank -> CONFIGURATION ERROR. It does not fall back.
 *
 * The bucket name is the operator's explicit statement of intent. Once it is set, quietly using local storage
 * because a credential was missing is the dangerous outcome, not the safe one: in a multi-replica or ephemeral
 * deployment the metadata row records `storageProvider: "local"`, only the instance that accepted the upload holds
 * the bytes, no other replica can serve the download, and a redeploy destroys them -- all without the operator ever
 * being told their configuration was incomplete.
 */

/** Everything private R2 needs. The bucket is listed last because it is also the intent signal for the others. */
export const PRIVATE_R2_REQUIRED_VARS = ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PRIVATE_BUCKET"] as const;

/** Whitespace-only is missing: an empty or blank value configures nothing. */
const isBlank = (value: string | undefined): boolean => (value ?? "").trim() === "";

/** The names of the required variables that are missing or blank, in declaration order. */
export function missingPrivateR2Vars(): string[] {
  return PRIVATE_R2_REQUIRED_VARS.filter((name) => isBlank(process.env[name]));
}

export type PrivateR2Configuration = "absent" | "complete" | "partial";
/**
 * The canonical three-state rule. Every private-R2 decision resolves through this so startup and runtime can never
 * disagree about what the environment says.
 */
export function privateR2Configuration(): PrivateR2Configuration {
  if (isBlank(process.env.R2_PRIVATE_BUCKET)) return "absent";
  return missingPrivateR2Vars().length === 0 ? "complete" : "partial";
}

/**
 * Fails closed on a half-configured private R2.
 *
 * The message names the variables that are missing so the deployment is fixable, and nothing else: no value, no
 * credential, no endpoint. An absent bucket is not an error -- that is the legitimate local deployment.
 */
export function assertPrivateR2Configured(): void {
  if (privateR2Configuration() !== "partial") return;
  throw new Error(
    "R2_PRIVATE_BUCKET is configured, but private R2 configuration is incomplete. " +
    `Missing: ${missingPrivateR2Vars().join(", ")}. ` +
    "Private booking documents will not silently fall back to local storage: local storage is only correct when " +
    "R2_PRIVATE_BUCKET is unset, because a multi-replica or ephemeral deployment cannot serve or retain them. " +
    "Set the missing variables, or unset R2_PRIVATE_BUCKET to use local private storage deliberately.",
  );
}

/**
 * Whether private R2 is the storage to use.
 *
 * It THROWS on a partial configuration rather than answering false, and that is deliberate: a boolean has only two
 * answers and the third state is the dangerous one. Returning false for a half-configured deployment is exactly how
 * an explicitly requested private bucket became a silent local fallback, so the ambiguity is removed at the one
 * place every caller asks.
 */
export function isPrivateR2Configured(): boolean {
  assertPrivateR2Configured();
  return privateR2Configuration() === "complete";
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
  // Defensive, and consistent with the startup check: a helper reached directly still refuses a half-configured
  // deployment rather than attempting a request with no credentials.
  assertPrivateR2Configured();
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
