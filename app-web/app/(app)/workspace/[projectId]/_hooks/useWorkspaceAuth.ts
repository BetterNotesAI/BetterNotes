import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUsageStatus, type UsageStatus } from "@/lib/api";
import type { User } from "@supabase/supabase-js";

export function useWorkspaceAuth() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [usageStatus, setUsageStatus] = useState<UsageStatus | null>(null);
    const [showPaywallModal, setShowPaywallModal] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) setUsageStatus(await getUsageStatus());
        }).catch(() => {
            setUser(null);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            // TOKEN_REFRESHED fires when returning to the tab — skip to avoid re-triggering
            if (event === "TOKEN_REFRESHED") return;
            setUser(session?.user ?? null);
            if (session?.user) setUsageStatus(await getUsageStatus());
            else setUsageStatus(null);
        });

        return () => subscription.unsubscribe();
    }, []);

    const canSendMessage = useCallback(async (): Promise<boolean> => {
        if (!user) { router.push("/login"); return false; }
        if (process.env.NEXT_PUBLIC_DEV_UNLIMITED === "true") return true;
        try {
            const status = await Promise.race<UsageStatus | null>([
                getUsageStatus(),
                new Promise<UsageStatus | null>((resolve) => setTimeout(() => resolve(null), 5000)),
            ]);
            if (status) setUsageStatus(status);
            if (status && typeof status.can_send === "boolean" && !status.can_send) {
                setShowPaywallModal(true);
                return false;
            }
        } catch { /* fail open */ }
        return true;
    }, [user, router]);

    return { user, usageStatus, showPaywallModal, setShowPaywallModal, canSendMessage };
}
