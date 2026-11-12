import { put } from "@vercel/blob";

// The project may carry two Blob stores: the original (private) one under the plain
// BLOB_* names and the public store we upload to, connected with the "PUBLIC" prefix
// (Vercel then names the variables PUBLIC_STORE_ID, PUBLIC_READ_WRITE_TOKEN, ...).
// Prefer the public store. A token is optional: with Vercel's OIDC connection only the
// store id exists and the SDK authenticates by itself.
const env = process.env;
const storeOptions = () => ({
  token:
    env.PUBLIC_READ_WRITE_TOKEN ||
    env.PUBLIC_BLOB_READ_WRITE_TOKEN ||
    env.BLOB_READ_WRITE_TOKEN ||
    undefined,
  storeId: env.PUBLIC_STORE_ID || env.PUBLIC_BLOB_STORE_ID || undefined,
});

export async function uploadDraftImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const pathname = `draft-images/${crypto.randomUUID()}.${ext}`;
  const blob = await put(pathname, file, { access: "public", ...storeOptions() });
  return blob.url;
}

export async function uploadGeneratedImage(
  buffer: Buffer,
  contentType = "image/png"
): Promise<string> {
  const ext = contentType === "image/png" ? "png" : "jpg";
  const pathname = `generated-images/${crypto.randomUUID()}.${ext}`;
  const blob = await put(pathname, buffer, {
    access: "public",
    ...storeOptions(),
    contentType,
  });
  return blob.url;
}

export async function uploadTikiaDocument(
  buffer: Buffer,
  filename: string,
  contentType = "application/octet-stream"
): Promise<string> {
  const ext = filename.split(".").pop() || "bin";
  const pathname = `tikia-documents/${crypto.randomUUID()}.${ext}`;
  const blob = await put(pathname, buffer, {
    access: "public",
    ...storeOptions(),
    contentType,
  });
  return blob.url;
}

export async function uploadContentScreenshot(buffer: Buffer, contentType = "image/png"): Promise<string> {
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const pathname = `content-screenshots/${crypto.randomUUID()}.${ext}`;
  const blob = await put(pathname, buffer, {
    access: "public",
    ...storeOptions(),
    contentType,
  });
  return blob.url;
}
