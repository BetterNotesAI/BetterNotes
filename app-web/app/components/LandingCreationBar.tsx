'use client';

import { useRouter } from 'next/navigation';
import { DocumentCreationBar, CreateDocumentInput } from '@/app/_components/DocumentCreationBar';

export function LandingCreationBar() {
  const router = useRouter();

  function handleSubmit(data: CreateDocumentInput) {
    // Store intent in localStorage so documents page can auto-create after signup
    localStorage.setItem('bn_pending_creation', JSON.stringify({
      prompt: data.prompt,
      templateId: data.templateId,
      specs: data.specs,
    }));
    router.push('/signup');
  }

  return (
    <DocumentCreationBar
      mode="landing"
      onSubmit={handleSubmit}
      placeholder="Describe the document you want to create..."
      submitLabel="Get started"
      autoFocus={false}
    />
  );
}
