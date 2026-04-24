'use client';

import ExamSetup, { type ExamSetupValues } from '@/app/(app)/exams/_components/ExamSetup';

interface Props {
  onSubmit: (values: ExamSetupValues) => void;
  isLoading: boolean;
  error: string | null;
}

export function ExamsPanel({ onSubmit, isLoading, error }: Props) {
  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4">
      <ExamSetup embedded onSubmit={onSubmit} isLoading={isLoading} error={error} />
    </div>
  );
}
