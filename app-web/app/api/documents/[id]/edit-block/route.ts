/**
 * POST /api/documents/[id]/edit-block
 * F3-M4.3 — calls app-api /latex/edit-block to get the modified block latex.
 * F3-M4.6 — "apply" mode: replaces the block in the full .tex, compiles, persists new version.
 * IA-M1   — sourceStart/sourceEnd substitution, chat_messages persistence, conversationHistory.
 *
 * Body (edit/preview mode):
 *   { blockId, blockLatex, blockType, adjacentBlocks[], userPrompt, fullLatex,
 *     sourceStart?, sourceEnd?, conversationHistory? }
 *
 * Body (apply mode — adds `apply: true` + `modifiedLatex`):
 *   { blockId, blockLatex, modifiedLatex, fullLatex, sourceStart?, sourceEnd? }
 *
 * Response (preview):  { modifiedLatex: string }
 * Response (apply):    { versionId: string, pdfUrl: string | null, latex: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildInternalApiHeaders, checkCreditQuota } from '@/lib/ai-usage';
import { buildDocumentProjectContext } from '@/lib/usage-project';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const API_INTERNAL_TOKEN = process.env.API_INTERNAL_TOKEN ?? '';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;

  // Verify ownership
  const { data: doc } = await supabase
    .from('documents')
    .select('id, template_id, current_version_id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }
  const projectContext = buildDocumentProjectContext(documentId, doc.template_id);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const {
    blockId,
    blockLatex,
    blockType,
    adjacentBlocks,
    userPrompt,
    fullLatex,
    // Offset-based substitution (IA-M1)
    sourceStart,
    sourceEnd,
    // Conversation history for multi-turn block editing (IA-M1)
    conversationHistory,
    // Apply mode
    apply,
    modifiedLatex: providedModifiedLatex,
  } = body as {
    blockId?: string;
    blockLatex?: string;
    blockType?: string;
    adjacentBlocks?: Array<{ blockId: string; blockType: string; latex_source: string }>;
    userPrompt?: string;
    fullLatex?: string;
    sourceStart?: number;
    sourceEnd?: number;
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
    apply?: boolean;
    modifiedLatex?: string;
  };

  // ─── APPLY mode (F3-M4.6) ────────────────────────────────────────────────

  if (apply) {
    if (!blockLatex || typeof blockLatex !== 'string') {
      return NextResponse.json({ error: 'blockLatex is required for apply' }, { status: 400 });
    }
    if (!providedModifiedLatex || typeof providedModifiedLatex !== 'string') {
      return NextResponse.json({ error: 'modifiedLatex is required for apply' }, { status: 400 });
    }
    if (!fullLatex || typeof fullLatex !== 'string') {
      return NextResponse.json({ error: 'fullLatex is required for apply' }, { status: 400 });
    }

    // 1. Substitute the block in fullLatex.
    // Strategy A (preferred): use sourceStart/sourceEnd offsets from the parser for a
    // byte-exact, unambiguous replacement that handles duplicate blocks gracefully.
    // Strategy B (fallback): first-occurrence string replace (original behaviour).
    let newFullLatex: string;
    const hasOffsets =
      typeof sourceStart === 'number' &&
      typeof sourceEnd === 'number' &&
      sourceStart >= 0 &&
      sourceEnd > sourceStart;

    if (hasOffsets) {
      // Validate that the slice at the offsets matches blockLatex (sanity check)
      const sliceAtOffset = fullLatex.slice(sourceStart, sourceEnd);
      if (sliceAtOffset !== blockLatex) {
        // Offsets stale — fall back to string replace with overlap check
        if (!fullLatex.includes(blockLatex)) {
          return NextResponse.json(
            { error: 'Block not found in document LaTeX — source may have changed. Reload and try again.' },
            { status: 409 }
          );
        }
        newFullLatex = fullLatex.replace(blockLatex, providedModifiedLatex);
      } else {
        newFullLatex =
          fullLatex.slice(0, sourceStart) +
          providedModifiedLatex +
          fullLatex.slice(sourceEnd);
      }
    } else {
      // Fallback: string replace (original strategy)
      if (!fullLatex.includes(blockLatex)) {
        return NextResponse.json(
          { error: 'Block not found in document LaTeX — source may have changed. Reload and try again.' },
          { status: 409 }
        );
      }
      newFullLatex = fullLatex.replace(blockLatex, providedModifiedLatex);
    }

    // 2. Compile via app-api compile-only
    let pdfBuffer: ArrayBuffer;
    let compiledLatex: string;

    try {
      const compileResp = await fetch(`${API_URL}/latex/compile-only`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(API_INTERNAL_TOKEN ? { Authorization: `Bearer ${API_INTERNAL_TOKEN}` } : {}),
        },
        body: JSON.stringify({ latex: newFullLatex, templateId: doc.template_id }),
      });

      if (!compileResp.ok) {
        const errBody = await compileResp.json().catch(() => ({}));
        return NextResponse.json(
          { error: errBody?.error ?? 'Compilation failed', compileLog: errBody?.compileLog },
          { status: 422 }
        );
      }

      pdfBuffer = await compileResp.arrayBuffer();
      const latexB64 = compileResp.headers.get('x-betternotes-latex') ?? '';
      compiledLatex = latexB64
        ? Buffer.from(latexB64, 'base64').toString('utf8')
        : newFullLatex;
    } catch (fetchErr: any) {
      return NextResponse.json(
        { error: `Failed to reach app-api: ${fetchErr.message}` },
        { status: 502 }
      );
    }

    // 3. Determine next version number
    const { data: lastVersion } = await supabase
      .from('document_versions')
      .select('version_number')
      .eq('document_id', documentId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersionNumber = (lastVersion?.version_number ?? 0) + 1;

    // 4. Upload PDF to storage
    const storagePath = `${user.id}/${documentId}/${nextVersionNumber}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('documents-output')
      .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });
    }

    // 5. Insert document_version
    const promptUsed = `[block-edit] block: ${(blockId ?? '').slice(0, 40)}`;
    const { data: version, error: versionError } = await supabase
      .from('document_versions')
      .insert({
        document_id: documentId,
        version_number: nextVersionNumber,
        latex_content: compiledLatex,
        pdf_storage_path: storagePath,
        compile_status: 'success',
        prompt_used: promptUsed,
      })
      .select('id')
      .single();

    if (versionError || !version) {
      return NextResponse.json(
        { error: `Failed to save version: ${versionError?.message}` },
        { status: 500 }
      );
    }

    // 6. Update document.current_version_id
    await supabase
      .from('documents')
      .update({ current_version_id: version.id, updated_at: new Date().toISOString() })
      .eq('id', documentId);

    // 7. Persist block-edit exchange in chat_messages (IA-M1)
    // The userPrompt comes from the conversationHistory last user turn (or blockId label as fallback).
    // We save the final state as a succinct pair so history is queryable later.
    const blockEditUserText =
      (conversationHistory ?? []).filter((t) => t.role === 'user').slice(-1)[0]?.content ??
      `[block-edit applied] block: ${(blockId ?? '').slice(0, 40)}`;
    const blockEditAssistantText = `[block-edit applied] ${providedModifiedLatex.slice(0, 200)}`;
    await supabase.from('chat_messages').insert([
      {
        document_id: documentId,
        user_id: user.id,
        role: 'user',
        content: blockEditUserText,
        version_id: version.id,
      },
      {
        document_id: documentId,
        user_id: user.id,
        role: 'assistant',
        content: blockEditAssistantText,
        version_id: version.id,
      },
    ]);

    // 8. Return signed PDF URL
    const { data: signedData } = await supabase.storage
      .from('documents-output')
      .createSignedUrl(storagePath, 3600);

    return NextResponse.json({
      versionId: version.id,
      pdfUrl: signedData?.signedUrl ?? null,
      latex: compiledLatex,
    });
  }

  // ─── PREVIEW mode (F3-M4.3) ──────────────────────────────────────────────

  if (!blockLatex || typeof blockLatex !== 'string') {
    return NextResponse.json({ error: 'blockLatex is required' }, { status: 400 });
  }
  if (!userPrompt || typeof userPrompt !== 'string') {
    return NextResponse.json({ error: 'userPrompt is required' }, { status: 400 });
  }

  const usageCheck = await checkCreditQuota(supabase, user.id);
  if (!usageCheck.allowed) {
    return NextResponse.json(
      { error: 'limit_reached', plan: usageCheck.plan ?? 'free', remaining: usageCheck.remaining ?? 0 },
      { status: 402 }
    );
  }

  try {
    const apiResp = await fetch(`${API_URL}/latex/edit-block`, {
      method: 'POST',
      headers: buildInternalApiHeaders(user.id, 'document_edit_block', API_INTERNAL_TOKEN, projectContext),
      body: JSON.stringify({
        blockId,
        blockLatex,
        blockType,
        adjacentBlocks: adjacentBlocks ?? [],
        userPrompt,
        fullLatex: fullLatex ?? '',
        conversationHistory: conversationHistory ?? [],
      }),
    });

    if (!apiResp.ok) {
      const errBody = await apiResp.json().catch(() => ({}));
      return NextResponse.json(
        { error: errBody?.error ?? 'AI edit failed' },
        { status: apiResp.status >= 500 ? 502 : apiResp.status }
      );
    }

    const data = await apiResp.json();
    return NextResponse.json({ modifiedLatex: data.modifiedLatex ?? '' });
  } catch (fetchErr: any) {
    return NextResponse.json(
      { error: `Failed to reach app-api: ${fetchErr.message}` },
      { status: 502 }
    );
  }
}
