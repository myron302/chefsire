import fs from "fs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
