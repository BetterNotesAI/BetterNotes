export type GenerationIntentMode = 'draft' | 'refine';

export interface GenerationIntentDecision {
  shouldGenerate: boolean;
  reason?: 'empty' | 'greeting' | 'insufficient_context' | 'confused_followup';
  reply?: string;
}

export interface IntentContextMessage {
  role?: string | null;
  content?: string | null;
}

const GREETING_ONLY_REGEX =
  /^(?:\s*(?:hey|hi|hello|hola|holi|buenas|good morning|good afternoon|good evening|yo|sup|what'?s up|que tal|how are you|how's it going|thanks|thank you|gracias)\s*[!?.;,]*)+$/i;

const INSTRUCTION_HINT_REGEX =
  /\b(create|generate|build|make|write|draft|summari[sz]e|convert|turn|organize|prepare|crea|genera|haz|hacer|escribe|resumir|resume|organiza|prepara)\b/i;

const SUBJECT_HINT_REGEX =
  /\b(cheat\s*sheet|cheatsheet|lecture\s*notes?|notes?|apuntes|summary|resumen|topic|tema|chapter|unit|exam|midterm|final|review|revision|formula|formulas|equation|equations|theorem|theory|problem|problems|homework|lab|report|paper)\b/i;

const CONFUSED_FOLLOW_UP_REGEX =
  /^(?:what|what\?+|huh|eh|que|qué|como|cómo|explain|explain\?|wtf|no entiendo|i don't understand|what do you mean)\s*[!?]*$/i;

const DETAIL_REQUEST_HINT_REGEX =
  /\b(need|detail|topic|key points|language|level|context|tema|puntos|idioma|nivel|contexto)\b/i;

const SHORT_TOPIC_TOKENS = new Set([
  'ai', 'ml', 'cv', 'nlp', 'rl',
  'math', 'stats', 'calc', 'algebra', 'geo',
  'bio', 'chem', 'physics', 'phys', 'thermo',
  'cs', 'db', 'sql', 'api', 'os',
  'law', 'econ', 'finance',
]);

const FILLER_WORDS = new Set([
  'a', 'an', 'and', 'are', 'be', 'build', 'by', 'can', 'create', 'do', 'for', 'from', 'generate', 'help',
  'i', 'in', 'is', 'it', 'make', 'me', 'my', 'of', 'on', 'please', 'the', 'this', 'to', 'with', 'write',
  'y', 'de', 'del', 'la', 'las', 'los', 'el', 'en', 'por', 'para', 'que', 'me', 'mi', 'un', 'una', 'unos',
  'unas', 'quiero', 'necesito', 'hacer', 'genera', 'crea', 'haz', 'porfa', 'favor',
]);

const CHEAT_SHEET_TEMPLATE_IDS = new Set([
  '2cols_portrait',
  'landscape_3col_maths',
  'cornell',
  'study_form',
]);

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractTokens(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function countMeaningfulTokens(value: string): number {
  return extractTokens(value).filter((token) => !FILLER_WORDS.has(token) && token.length >= 3).length;
}

function getMeaningfulTokens(value: string): string[] {
  return extractTokens(value).filter((token) => !FILLER_WORDS.has(token));
}

function isLikelySingleTopicToken(token: string): boolean {
  if (SHORT_TOPIC_TOKENS.has(token)) return true;
  if (token.length < 6) return false;
  const hasVowel = /[aeiouáéíóú]/i.test(token);
  const hasConsonant = /[bcdfghjklmnñpqrstvwxyz]/i.test(token);
  const uniqueChars = new Set(token.split('')).size;
  return hasVowel && hasConsonant && uniqueChars >= 4;
}

function looksLikeTopicPrompt(value: string): boolean {
  const tokens = getMeaningfulTokens(value);
  if (tokens.length === 0) return false;
  if (tokens.length === 1) return isLikelySingleTopicToken(tokens[0]);
  if (tokens.length === 2) return tokens.some((token) => isLikelySingleTopicToken(token));
  return countMeaningfulTokens(value) >= 2;
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function detectReplyLanguage(prompt: string, recentMessages: IntentContextMessage[]): 'es' | 'en' {
  const joined = `${prompt} ${(recentMessages ?? []).map((m) => m.content ?? '').join(' ')}`.toLowerCase();

  const spanishScore =
    (/[¿¡áéíóúñ]/.test(joined) ? 2 : 0) +
    ((joined.match(/\b(hola|buenas|que|qué|como|cómo|por|para|tema|apuntes|idioma|nivel|gracias|vale|quiero|necesito)\b/g) ?? []).length);

  const englishScore =
    ((joined.match(/\b(hello|hey|what|please|topic|notes|language|level|thanks|document|build|create)\b/g) ?? []).length);

  if (spanishScore > englishScore) return 'es';
  return 'en';
}

function resolveTemplateLabel(templateId: string, language: 'es' | 'en'): string {
  if (language === 'es') {
    if (templateId === 'lecture_notes') return 'apuntes de clase';
    if (CHEAT_SHEET_TEMPLATE_IDS.has(templateId)) return 'cheat sheet';
    return 'documento';
  }
  if (templateId === 'lecture_notes') return 'lecture notes';
  if (CHEAT_SHEET_TEMPLATE_IDS.has(templateId)) return 'cheat sheet';
  return 'document';
}

function normalizeForComparison(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function pickVariant(options: string[], seed: string, lastAssistantReply: string | null): string {
  if (options.length === 0) return '';
  const start = hashSeed(seed) % options.length;
  const lastNorm = lastAssistantReply ? normalizeForComparison(lastAssistantReply) : null;

  for (let offset = 0; offset < options.length; offset++) {
    const candidate = options[(start + offset) % options.length];
    if (!lastNorm || normalizeForComparison(candidate) !== lastNorm) {
      return candidate;
    }
  }
  return options[start];
}

function buildReplyVariants({
  reason,
  mode,
  language,
  templateLabel,
  normalizedPrompt,
}: {
  reason: NonNullable<GenerationIntentDecision['reason']>;
  mode: GenerationIntentMode;
  language: 'es' | 'en';
  templateLabel: string;
  normalizedPrompt: string;
}): string[] {
  const shortPrompt = normalizedPrompt.length <= 32 ? `"${normalizedPrompt}"` : language === 'es' ? 'ese mensaje' : 'that message';

  if (language === 'es') {
    if (reason === 'greeting') {
      if (mode === 'refine') {
        return [
          '¡Hey! Dime qué quieres cambiar y lo actualizo al momento.',
          '¡Hola! ¿Qué parte quieres editar: estructura, tono, fórmulas o longitud?',
          'Perfecto, ¿qué cambio concreto hacemos en el documento?',
        ];
      }
      return [
        `¡Hey! ¿Qué quieres crear hoy? Si me dices el tema, te genero tu ${templateLabel}.`,
        `¡Hola! Pásame el tema y te monto el primer borrador del ${templateLabel}.`,
        `¡Buenas! Dime de qué trata y arranco con tu ${templateLabel}.`,
      ];
    }

    if (reason === 'confused_followup') {
      return [
        `Claro, te explico rápido: con ${shortPrompt} no sé todavía el tema. Dime tema + nivel y lo genero.`,
        'Buena pregunta. Solo necesito una frase con el tema que quieres cubrir y el nivel (por ejemplo, bachillerato o uni).',
        'Sin problema. Pásame el tema exacto y 2-3 puntos clave, y empiezo a generarlo.',
      ];
    }

    return [
      `Puedo generarlo, pero me falta contexto. Dame el tema exacto, puntos clave e idioma para preparar un buen ${templateLabel}.`,
      `Voy contigo, pero con ${shortPrompt} no tengo suficiente info aún. ¿Tema, nivel y enfoque?`,
      `Para que quede bien: dime tema + nivel + qué quieres priorizar (resumen, fórmulas, ejemplos, etc.).`,
      `Perfecto, lo hago. Solo necesito 3 datos: tema, profundidad y idioma.`,
    ];
  }

  if (reason === 'greeting') {
    if (mode === 'refine') {
      return [
        'Hey! Tell me what to change and I can update it right away.',
        'Hi! What should I edit: structure, tone, formulas, or length?',
        'Got it. Share the exact change you want and I will apply it.',
      ];
    }
    return [
      `Hey! What would you like to build today? Tell me the topic and I can generate your ${templateLabel}.`,
      `Hi! Give me the topic and I will draft your ${templateLabel}.`,
      `Great, I can start now. What topic should this ${templateLabel} cover?`,
    ];
  }

  if (reason === 'confused_followup') {
    return [
      `Totally fair. With ${shortPrompt}, I still don't know the topic. Share topic + level and I'll generate it.`,
      'Quick version: tell me the exact topic and level, and I can build the first draft immediately.',
      'No worries. I just need one line with topic, scope, and language.',
    ];
  }

  return [
    `I can generate your ${templateLabel}, but I need a bit more detail first: topic, key points, and preferred language or level.`,
    `I can do this, but ${shortPrompt} is still too broad. Tell me the topic, level, and what to prioritize.`,
    'Give me 2-3 key points plus the target level, and I will generate a stronger first draft.',
    `Before I generate, I need just three inputs: topic, depth, and language.`,
  ];
}

function buildClarificationReply({
  reason,
  mode,
  templateId,
  normalizedPrompt,
  recentMessages,
}: {
  reason: NonNullable<GenerationIntentDecision['reason']>;
  mode: GenerationIntentMode;
  templateId: string;
  normalizedPrompt: string;
  recentMessages: IntentContextMessage[];
}): string {
  const language = detectReplyLanguage(normalizedPrompt, recentMessages);
  const templateLabel = resolveTemplateLabel(templateId, language);
  const variants = buildReplyVariants({
    reason,
    mode,
    language,
    templateLabel,
    normalizedPrompt,
  });
  const lastAssistantReply =
    recentMessages.find((m) => (m.role ?? '').toLowerCase() === 'assistant')?.content?.trim() ?? null;

  return pickVariant(
    variants,
    `${normalizedPrompt}|${reason}|${mode}|${templateId}|${variants.length}|${recentMessages.length}`,
    lastAssistantReply,
  );
}

export function decideDocumentGenerationIntent({
  prompt,
  templateId,
  mode,
  recentMessages = [],
}: {
  prompt: string;
  templateId: string;
  mode: GenerationIntentMode;
  recentMessages?: IntentContextMessage[];
}): GenerationIntentDecision {
  const normalizedPrompt = normalizeWhitespace(prompt);

  if (!normalizedPrompt) {
    const reason: NonNullable<GenerationIntentDecision['reason']> = 'empty';
    return {
      shouldGenerate: false,
      reason,
      reply: buildClarificationReply({ reason, mode, templateId, normalizedPrompt, recentMessages }),
    };
  }

  const lastAssistantReply = recentMessages
    .find((msg) => (msg.role ?? '').toLowerCase() === 'assistant')
    ?.content
    ?.trim();
  const assistantAskedForDetails =
    typeof lastAssistantReply === 'string' && DETAIL_REQUEST_HINT_REGEX.test(lastAssistantReply.toLowerCase());
  const confusedFollowup = CONFUSED_FOLLOW_UP_REGEX.test(normalizedPrompt);
  const likelyTopicPrompt = looksLikeTopicPrompt(normalizedPrompt);

  if (confusedFollowup && assistantAskedForDetails) {
    const reason: NonNullable<GenerationIntentDecision['reason']> = 'confused_followup';
    return {
      shouldGenerate: false,
      reason,
      reply: buildClarificationReply({ reason, mode, templateId, normalizedPrompt, recentMessages }),
    };
  }

  if (GREETING_ONLY_REGEX.test(normalizedPrompt)) {
    const reason: NonNullable<GenerationIntentDecision['reason']> = 'greeting';
    return {
      shouldGenerate: false,
      reason,
      reply: buildClarificationReply({ reason, mode, templateId, normalizedPrompt, recentMessages }),
    };
  }

  if (mode === 'refine') {
    return { shouldGenerate: true };
  }

  // If we already asked for details and the user now gives a clear topic,
  // proceed instead of asking again.
  if (assistantAskedForDetails && likelyTopicPrompt) {
    return { shouldGenerate: true };
  }

  const hasInstructionHint = INSTRUCTION_HINT_REGEX.test(normalizedPrompt);
  const hasSubjectHint = SUBJECT_HINT_REGEX.test(normalizedPrompt);
  const meaningfulTokenCount = countMeaningfulTokens(normalizedPrompt);
  const hasEnoughContext = normalizedPrompt.length >= 24 || meaningfulTokenCount >= 3;

  // With an explicit template (non-auto), a clean single-topic prompt is enough.
  const isTemplateConstrainedDraft = mode === 'draft' && templateId !== 'auto';
  if (hasInstructionHint || hasSubjectHint || hasEnoughContext || (isTemplateConstrainedDraft && likelyTopicPrompt)) {
    return { shouldGenerate: true };
  }

  const reason: NonNullable<GenerationIntentDecision['reason']> = 'insufficient_context';
  return {
    shouldGenerate: false,
    reason,
    reply: buildClarificationReply({ reason, mode, templateId, normalizedPrompt, recentMessages }),
  };
}
