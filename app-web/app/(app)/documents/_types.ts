export interface LocalAttachment {
  name: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;  // rellenado tras el upload exitoso
}

export interface DocumentSpecs {
  pages: number;          // 1-10
  density: 'compact' | 'balanced' | 'spacious';
  language: 'en' | 'es' | 'fr' | 'de' | 'auto';
  topicHint?: string;     // opcional, max 200 chars
  attachments?: LocalAttachment[];
}
