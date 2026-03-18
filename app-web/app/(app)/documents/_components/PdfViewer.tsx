'use client';

import { useEffect, useRef, useState } from 'react';

interface PdfViewerProps {
  url: string | null;
  isLoading?: boolean;
}

export function PdfViewer({ url, isLoading }: PdfViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setObjectUrl(null);
      return;
    }

    // If it's already an object URL or data URL, use directly
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      setObjectUrl(url);
      return;
    }

    // For signed Supabase URLs, fetch and create object URL to avoid CORS/redirect issues
    let active = true;
    fetch(url)
      .then((r) => r.blob())
      .then((blob) => {
        if (active) {
          const objUrl = URL.createObjectURL(blob);
          setObjectUrl(objUrl);
        }
      })
      .catch(() => {
        // Fallback: use URL directly
        if (active) setObjectUrl(url);
      });

    return () => {
      active = false;
    };
  }, [url]);

  // Revoke previous object URL when it changes
  useEffect(() => {
    return () => {
      if (objectUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(objectUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#111] text-gray-500">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin mx-auto" />
          <p className="text-sm">Generating your document...</p>
        </div>
      </div>
    );
  }

  if (!objectUrl && !url) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#111] text-gray-600">
        <div className="text-center space-y-2">
          <svg className="w-12 h-12 mx-auto opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">Describe your document in the chat to generate a PDF</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#111] min-h-0">
      {objectUrl ? (
        <iframe
          ref={iframeRef}
          src={objectUrl}
          className="flex-1 w-full border-0"
          title="PDF Preview"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
