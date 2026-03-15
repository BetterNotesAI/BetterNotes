"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PdfViewerProps {
    url: string;
    zoom?: number; // percentage, 100 = 100%
}

export default function PdfViewer({ url, zoom = 100 }: PdfViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);

    return (
        <div className="w-full h-full overflow-auto relative flex flex-col items-center py-6 gap-4">
            {/* Background matching the app style */}
            <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute inset-0 bg-neutral-950" />
                <div className="absolute inset-0 bg-[radial-gradient(900px_600px_at_35%_10%,rgba(99,102,241,0.22),transparent_60%),radial-gradient(900px_600px_at_75%_30%,rgba(236,72,153,0.18),transparent_60%),radial-gradient(900px_600px_at_70%_85%,rgba(34,197,94,0.12),transparent_60%)]" />
            </div>
            <Document
                file={url}
                onLoadSuccess={({ numPages }) => { setNumPages(numPages); setError(null); }}
                onLoadError={() => setError("Failed to load PDF.")}
                loading={
                    <div className="flex items-center justify-center h-32 text-white/30 text-sm">Loading…</div>
                }
            >
                {error ? (
                    <div className="text-white/40 text-sm">{error}</div>
                ) : (
                    Array.from({ length: numPages }, (_, i) => (
                        <div key={i + 1} className="shadow-[0_4px_32px_rgba(0,0,0,0.6)]">
                            <Page
                                pageNumber={i + 1}
                                scale={zoom / 100}
                                renderAnnotationLayer
                                renderTextLayer
                            />
                        </div>
                    ))
                )}
            </Document>
        </div>
    );
}
