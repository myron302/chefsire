import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, mkdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { UPLOADS_DIR } from "./uploads-dir";

const privateRoot = path.join(UPLOADS_DIR, ".marketplace-private");
const referencePattern = /^private:([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;

function privatePath(owner: string, id: string) {
  const ownerDirectory = createHash("sha256").update(owner).digest("hex");
  return path.join(privateRoot, ownerDirectory, id);
}

export async function storeMarketplaceDigitalFile(owner: string, stagedPath: string) {
  const id = randomUUID();
  const destination = privatePath(owner, id);
  const pending = destination + ".part";
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  try {
    await copyFile(stagedPath, pending, constants.COPYFILE_EXCL);
    await rename(pending, destination);
  } catch (error) {
    await unlink(pending).catch(() => {});
    throw error;
  }
  return `private:${id}`;
}

export async function marketplaceDigitalFilePath(owner: string, reference?: string | null) {
  const id = referencePattern.exec(reference ?? "")?.[1];
  if (!id) return null;
  const filename = privatePath(owner, id);
  try {
    return (await stat(filename)).isFile() ? filename : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
