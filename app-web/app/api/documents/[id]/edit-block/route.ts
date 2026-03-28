/**
 * POST /api/documents/[id]/edit-block
 * F3-M4.3 — calls app-api /latex/edit-block to get the modified block latex.
 * F3-M4.6 — "apply" mode: replaces the block in the full .tex, compiles, persists new version.
 *
 * Body (edit/preview mode):
 *   { blockId, blockLatex, blockType, adjacentBlocks[], userPrompt, fullLatex }
 *
 * Body (apply mode — adds `apply: true` + `modifiedLatex`):
 *   { blockId, blockLatex, modifiedLatex, fullLatex }
 *
 * Response (preview):  { modifiedLatex: string }
 * Response (apply):    { versionId: string, pdfUrl: string | null, latex: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // 1. Exact-string replacement of blockLatex inside fullLatex
    if (!fullLatex.includes(blockLatex)) {
      return NextResponse.json(
        { error: 'Block not found in document LaTeX — source may have changed. Reload and try again.' },
        { status: 409 }
      );
    }

    // Replace ONLY the first occurrence (blocks are unique by latex_source in practice)
    const newFullLatex = fullLatex.replace(blockLatex, providedModifiedLatex);

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
        body: JSON.stringify({ latex: newFullLatex }),
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

    // 7. Return signed PDF URL
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

  try {
    const apiResp = await fetch(`${API_URL}/latex/edit-block`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_INTERNAL_TOKEN ? { Authorization: `Bearer ${API_INTERNAL_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        blockId,
        blockLatex,
        blockType,
        adjacentBlocks: adjacentBlocks ?? [],
        userPrompt,
        fullLatex: fullLatex ?? '',
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
