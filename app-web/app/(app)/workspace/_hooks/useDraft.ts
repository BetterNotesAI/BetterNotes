import { useEffect, useState, useCallback, useRef } from "react";
import { saveWorkspaceDraft, loadWorkspaceDraft, clearWorkspaceDraft, type WorkspaceDraft } from "@/lib/draft";

type Msg = { role: "user" | "assistant"; content: string };

const INITIAL_MESSAGE: Msg = {
    role: "assistant",
    content: 'Tell me what you want. Example: \u201cGenerate a formula sheet from my lecture notes (LaTeX + PDF)\u201d',
};

interface UseDraftParams {
    selectedTemplateId: string | null;
}

export function useDraft({ selectedTemplateId }: UseDraftParams) {
    const [draftLatex, setDraftLatex] = useState("");
    const [savedLatex, setSavedLatex] = useState("");
    const [compiledLatex, setCompiledLatex] = useState("");
    const [dirty, setDirty] = useState(false);
    const [messages, setMessages] = useState<Msg[]>([INITIAL_MESSAGE]);
    const [showRestoreBanner, setShowRestoreBanner] = useState(false);
    const [pendingDraft, setPendingDraft] = useState<WorkspaceDraft | null>(null);

    const previewOutdated = compiledLatex !== "" && compiledLatex !== savedLatex;

    // Auto-save draft on changes
    useEffect(() => {
        if (draftLatex || savedLatex || messages.length > 1) {
            saveWorkspaceDraft({ draftLatex, savedLatex, messages, selectedTemplateId });
        }
    }, [draftLatex, savedLatex, messages, selectedTemplateId]);

    // Check for saved draft on mount
    useEffect(() => {
        const draft = loadWorkspaceDraft();
        if (draft && (draft.draftLatex || draft.savedLatex || draft.messages.length > 1)) {
            setPendingDraft(draft);
            setShowRestoreBanner(true);
        }
    }, []);

    const restoreDraft = useCallback((onRestored?: (draft: WorkspaceDraft) => void) => {
        if (!pendingDraft) return;
        setDraftLatex(pendingDraft.draftLatex);
        setSavedLatex(pendingDraft.savedLatex);
        setMessages(pendingDraft.messages);
        setShowRestoreBanner(false);
        setPendingDraft(null);
        onRestored?.(pendingDraft);
    }, [pendingDraft]);

    const dismissDraft = useCallback(() => {
        clearWorkspaceDraft();
        setShowRestoreBanner(false);
        setPendingDraft(null);
    }, []);

    const resetWorkspace = useCallback(() => {
        setMessages([INITIAL_MESSAGE]);
        setDraftLatex("");
        setSavedLatex("");
        setCompiledLatex("");
        setDirty(false);
        clearWorkspaceDraft();
    }, []);

    return {
        draftLatex, setDraftLatex,
        savedLatex, setSavedLatex,
        compiledLatex, setCompiledLatex,
        dirty, setDirty,
        previewOutdated,
        messages, setMessages,
        showRestoreBanner,
        pendingDraft,
        restoreDraft,
        dismissDraft,
        resetWorkspace,
    };
}
