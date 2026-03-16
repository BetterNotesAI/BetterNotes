"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getUsageStatus, type UsageStatus } from "@/lib/api";
import TemplateCard from "@/app/components/TemplateCard";
import PdfPreviewModal from "@/app/components/PdfPreviewModal";
import { templates, type TemplateDef as Template } from "@/lib/templates";

export default function TemplatesPage() {
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [usageStatus, setUsageStatus] = useState<UsageStatus | null>(null);
    const pdfUrl = selectedTemplate?.previewPath ?? "";

    useEffect(() => {
        async function fetchUsageStatus() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const status = await getUsageStatus();
                setUsageStatus(status);
            }
        }

        fetchUsageStatus();
    }, []);

    return (
        <main className="relative min-h-screen text-white">
            <section className="mx-auto max-w-6xl px-6 py-10">
                <h1 className="text-2xl font-semibold text-foreground">Templates</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Click a template to preview it, then use it in your workspace.
                </p>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {templates.map((t) => (
                        <TemplateCard
                            key={t.id}
                            t={t}
                            onClick={setSelectedTemplate}
                        />
                    ))}
                </div>
            </section>

            <PdfPreviewModal
                isOpen={selectedTemplate !== null}
                onClose={() => setSelectedTemplate(null)}
                pdfUrl={pdfUrl}
                title={selectedTemplate?.name ?? ""}
                templateId={selectedTemplate?.id}
                isPro={selectedTemplate?.isPro ?? false}
                userIsPro={usageStatus?.is_paid ?? false}
            />
        </main>
    );
}
