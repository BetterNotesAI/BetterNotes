import OpenAI from "openai";
import { env } from "../env.js";
import {
  buildFallbackDocument,
  generatedDocumentSchema,
  type GeneratedDocument
} from "./template.js";

const openai = new OpenAI({
  apiKey: env.openAiApiKey
});

export async function generateStructuredDocument(options: {
  prompt: string;
  notes: string;
  templateName: string;
}): Promise<GeneratedDocument> {
  const { prompt, notes, templateName } = options;

  if (!notes.trim()) {
    return buildFallbackDocument(prompt, notes);
  }

  try {
    const response = await openai.chat.completions.create({
      model: env.openAiModel,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You transform study notes into structured JSON for LaTeX rendering. Return valid JSON with keys: title, summary, sections, equations. Sections must include heading and bullets arrays. Equations should be concise mathematical expressions as LaTeX strings without delimiters."
        },
        {
          role: "user",
          content: [
            `Template: ${templateName}`,
            `Prompt: ${prompt || "No prompt supplied"}`,
            "Notes:",
            notes
          ].join("\n\n")
        }
      ]
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return buildFallbackDocument(prompt, notes);
    }

    const parsed = JSON.parse(content);
    return generatedDocumentSchema.parse(parsed);
  } catch {
    return buildFallbackDocument(prompt, notes);
  }
}
