/**
 * Upload a data: URL or blob: URL to /api/upload and return the server URL.
 * This avoids storing giant base64 strings in the database and makes videos
 * playable across sessions (blob: URLs are session-only).
 */
export async function uploadMediaUrl(dataOrBlobUrl: string): Promise<string> {
  let blob: Blob;

  if (dataOrBlobUrl.startsWith("blob:")) {
    const res = await fetch(dataOrBlobUrl);
    blob = await res.blob();
  } else if (dataOrBlobUrl.startsWith("data:")) {
    const [header, base64] = dataOrBlobUrl.split(",");
    const mime = header.split(":")[1]?.split(";")[0] ?? "application/octet-stream";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    blob = new Blob([bytes], { type: mime });
  } else {
    return dataOrBlobUrl; // already a real URL, nothing to do
  }

  const mimeSubtype = blob.type.split("/")[1]?.split(";")[0] ?? "bin";
  const extByMimeSubtype: Record<string, string> = {
    mp4: "mp4",
    quicktime: "mov",
    webm: "webm",
  };
  const ext = extByMimeSubtype[mimeSubtype] ?? mimeSubtype;
  const form = new FormData();
  form.append("file", blob, `media.${ext}`);

  const res = await fetch("/api/upload", {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? "Failed to upload media");
  }
  const data = await res.json();
  return data.url as string;
}
