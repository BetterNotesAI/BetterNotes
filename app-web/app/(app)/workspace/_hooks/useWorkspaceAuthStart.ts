import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUsageStatus, incrementMessageCount, createProject, saveOutputFile, type UsageStatus } from "@/lib/api";
import { clearWorkspaceDraft } from "@/lib/draft";
import type { User } from "@supabase/supabase-js";

type Msg = { role: "user" | "assistant"; content: string };

interface UseWorkspaceAuthStartParams {
    getMessages: () => Msg[];
    getSelectedTemplateId: () => string | null;
    getDraftLatex: () => string;
    getSavedLatex: () => string;
    getCurrentProjectId: () => string | null;
    setCurrentProjectId: (id: string | null) => void;
}

export function useWorkspaceAuthStart({
    getMessages,
    getSelectedTemplateId,
    getDraftLatex,
    getSavedLatex,
    getCurrentProjectId,
    setCurrentProjectId,
}: UseWorkspaceAuthStartParams) {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [usageStatus, setUsageStatus] = useState<UsageStatus | null>(null);
    const [anonymousMessageSent, setAnonymousMessageSent] = useState(false);
    const [showPaywallModal, setShowPaywallModal] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            if (localStorage.getItem("betternotes_anonymous_sent") === "true") {
                setAnonymousMessageSent(true);
            }
        }
    }, []);

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                const status = await getUsageStatus();
                setUsageStatus(status);
                if (event === "SIGNED_IN") {
                    const draft = await import("@/lib/draft").then((m) => m.loadWorkspaceDraft());
                    if (draft && (draft.draftLatex || draft.savedLatex || draft.messages.length > 1)) {
                        const userMsgs = draft.messages.filter((m: Msg) => m.role === "user");
                        const title = userMsgs[0]?.content.slice(0, 50) || "Untitled";
                        const { project } = await createProject({ title, template_id: draft.selectedTemplateId || undefined });
                        if (project) {
                            const latexContent = draft.savedLatex || draft.draftLatex;
                            if (latexContent) await saveOutputFile(project.id, "main.tex", latexContent);
                            setCurrentProjectId(project.id);
                            window.history.replaceState(null, "", "/workspace/" + project.id);
                            clearWorkspaceDraft();
                        }
                    }
                }
            } else {
                setUsageStatus(null);
            }
        });

        supabase.auth.getSession().then(async ({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) setUsageStatus(await getUsageStatus());
        }).catch(() => setUser(null));

        return () => subscription.unsubscribe();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const canSendMessage = useCallback(async (): Promise<boolean> => {
        if (!user && !anonymousMessageSent) return true;
        if (!user && anonymousMessageSent) {
            router.push("/login?message=" + encodeURIComponent("Sign up to continue generating documents. Your work will be saved!"));
            return false;
        }
        if (user) {
            try {
                const status = await Promise.race<UsageStatus | null>([
                    getUsageStatus(),
                    new Promise<UsageStatus | null>((resolve) => setTimeout(() => resolve(null), 5000)),
                ]);
                if (status) setUsageStatus(status);
                if (!status) return true;
                if (typeof status.can_send === "boolean" && !status.can_send) {
                    setShowPaywallModal(true);
                    return false;
                }
            } catch { return true; }
        }
        return true;
    }, [user, anonymousMessageSent, router]);

    const onMessageSent = useCallback(async (latexContent?: string, newMessages?: Msg[]) => {
        if (!user) {
            setAnonymousMessageSent(true);
            if (typeof window !== "undefined") localStorage.setItem("betternotes_anonymous_sent", "true");
            return;
        }
        try {
            const result = await incrementMessageCount();
            if (result) {
                setUsageStatus((prev) => prev ? { ...prev, message_count: result.new_count, remaining: result.remaining, can_send: !result.limit_reached } : null);
            }
            const latex = latexContent || getSavedLatex() || getDraftLatex();
            const projectId = getCurrentProjectId();
            if (projectId) {
                if (latex) await saveOutputFile(projectId, "main.tex", latex);
            } else {
                const msgs = newMessages || getMessages();
                const userMsgs = msgs.filter((m) => m.role === "user");
                const title = userMsgs[0]?.content.slice(0, 50) || "Untitled";
                const { project } = await createProject({ title, template_id: getSelectedTemplateId() || undefined });
                if (project) {
                    if (latex) await saveOutputFile(project.id, "main.tex", latex);
                    setCurrentProjectId(project.id);
                    window.history.replaceState(null, "", "/workspace/" + project.id);
                }
            }
        } catch (e) {
            console.warn("Failed to auto-save project:", e);
        }
    }, [user, getMessages, getCurrentProjectId, getSavedLatex, getDraftLatex, getSelectedTemplateId, setCurrentProjectId]);

    return { user, usageStatus, setUsageStatus, anonymousMessageSent, showPaywallModal, setShowPaywallModal, canSendMessage, onMessageSent };
}
