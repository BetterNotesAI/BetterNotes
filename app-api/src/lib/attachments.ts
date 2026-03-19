// app-api/src/lib/attachments.ts
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require('pdf-parse');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mammoth: { extractRawText(opts: { buffer: Buffer }): Promise<{ value: string }> } = require('mammoth');

import { AttachmentInput } from './ai/types';

const MAX_TEXT_CHARS_PER_FILE = 12_000;
const DOWNLOAD_TIMEOUT_MS = 15_000;

export interface ProcessedAttachment extends AttachmentInput {
  extractedText?: string;  // for PDFs and DOCX
  imageBuffer?: Buffer;    // only for images with embedInPdf=true
}

export async function processAttachments(
  files: AttachmentInput[]
): Promise<ProcessedAttachment[]> {
  if (!files || files.length === 0) return [];

  return Promise.all(files.map(async (file): Promise<ProcessedAttachment> => {
    if (!file.url) return { ...file };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    let buffer: Buffer;
    try {
      const res = await fetch(file.url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      buffer = Buffer.from(await res.arrayBuffer());
    } catch {
      // Download failed — return unprocessed so the pipeline can still continue
      return { ...file };
    } finally {
      clearTimeout(timeout);
    }

    const mimeType = file.mimeType ?? '';

    // PDF — extract plain text
    if (mimeType === 'application/pdf') {
      try {
        const parsed = await pdfParse(buffer);
        const text = parsed.text.slice(0, MAX_TEXT_CHARS_PER_FILE);
        return { ...file, extractedText: text };
      } catch {
        return { ...file };
      }
    }

    // DOCX — extract plain text
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      try {
        const result = await mammoth.extractRawText({ buffer });
        const text = result.value.slice(0, MAX_TEXT_CHARS_PER_FILE);
        return { ...file, extractedText: text };
      } catch {
        return { ...file };
      }
    }

    // Image — encode as base64; optionally keep raw buffer for PDF embed
    if (mimeType.startsWith('image/')) {
      const base64 = buffer.toString('base64');
      const result: ProcessedAttachment = { ...file, data: base64 };
      if (file.embedInPdf) {
        result.imageBuffer = buffer;
      }
      return result;
    }

    return { ...file };
  }));
}
