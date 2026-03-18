export interface DocumentSpecs {
  pages: number;          // 1-10
  density: 'compact' | 'balanced' | 'spacious';
  language: 'en' | 'es' | 'fr' | 'de' | 'auto';
  topicHint?: string;     // opcional, max 200 chars
}
