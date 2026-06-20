import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

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

export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<string> {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) {
    throw new Error("R2_BUCKET is required to upload media");
  }

  await r2Client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));

  return key;
}

export function publicUrl(key: string): string {
  const baseUrl = process.env.R2_PUBLIC_BASE_URL;
  if (!baseUrl) {
    throw new Error("R2_PUBLIC_BASE_URL is required to build media URLs");
  }

  return `${baseUrl.replace(/\/$/, "")}/${key}`;
}
