"use client";

import { useEffect } from "react";
import { ToastProvider } from "./Toast";
import { DialogProvider } from "./ConfirmDialog";

/** Applies the stored theme class to <html> on every mount / navigation. */
function ThemeApplier() {
    useEffect(() => {
        try {
            const t = localStorage.getItem("betternotes-theme");
            const theme = t === "light" ? "light" : "dark";
            document.documentElement.classList.toggle("dark", theme === "dark");
            document.documentElement.classList.toggle("light", theme === "light");
        } catch {
            // localStorage unavailable — leave as-is
        }
    }, []);
    return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
    return (
        <DialogProvider>
            <ToastProvider>
                <ThemeApplier />
                {children}
            </ToastProvider>
        </DialogProvider>
    );
}
