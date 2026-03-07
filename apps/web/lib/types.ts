import type { JobStatus, SubscriptionStatus } from "@betternotes/shared";

export type TemplateRecord = {
  id: string;
  slug: string;
  name: string;
  description: string;
  preview_image_path: string | null;
};

export type JobRecord = {
  id: string;
  template_id: string;
  prompt: string;
  status: JobStatus;
  output_pdf_path: string | null;
  output_tex_path: string | null;
  error_message: string | null;
  created_at: string;
};

export type SubscriptionRecord = {
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  price_id: string | null;
};
