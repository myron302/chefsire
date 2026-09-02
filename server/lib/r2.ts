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
 * not be true. R2_PRIVATE_BUCKET must therefore name a bucket with no public access binding. When it is absent,
 * `isPrivateR2Configured()` is false and callers fall back to private local storage instead of quietly downgrading a
 * booking document into the public namespace.
 */
export function isPrivateR2Configured(): boolean {
  const names = ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PRIVATE_BUCKET"] as const;
  return names.every((name) => Boolean(process.env[name]?.trim()));
}

function privateBucket(): string {
  const bucket = process.env.R2_PRIVATE_BUCKET?.trim();
  if (!bucket) throw new Error("R2_PRIVATE_BUCKET is required to store private booking documents");
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
