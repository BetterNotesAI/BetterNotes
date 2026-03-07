import type { SupabaseClient } from "@supabase/supabase-js";
import pdfParse from "pdf-parse";

export type UploadRow = {
  id: string;
  storage_path: string;
  mime_type: string;
};

async function blobToBuffer(blob: Blob): Promise<Buffer> {
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const parsed = await pdfParse(buffer);
    return parsed.text ?? "";
  } catch {
    return "";
  }
}

function extractTextFromPlain(buffer: Buffer): string {
  return buffer.toString("utf8");
}

export async function collectTextFromUploads(
  supabase: SupabaseClient,
  uploads: UploadRow[]
): Promise<string> {
  const chunks: string[] = [];

  for (const upload of uploads) {
    const { data, error } = await supabase.storage.from("uploads").download(upload.storage_path);
    if (error || !data) {
      continue;
    }

    const buffer = await blobToBuffer(data);
    const isPdf =
      upload.mime_type.includes("pdf") || upload.storage_path.toLowerCase().endsWith(".pdf");

    if (isPdf) {
      chunks.push(await extractTextFromPdf(buffer));
    } else {
      chunks.push(extractTextFromPlain(buffer));
    }
  }

  return chunks.join("\n\n");
}
