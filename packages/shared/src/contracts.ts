export const JOB_STATUSES = ["queued", "running", "done", "error"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const SUBSCRIPTION_ACTIVE_STATUSES = ["active", "trialing"] as const;
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused"
  | null;

export type CreateJobInput = {
  template_id: string;
  prompt: string;
  input_text?: string;
  upload_ids?: string[];
};

export type CreateJobOutput = {
  job_id: string;
  status: JobStatus;
};

export type WorkerRenderInput = {
  job_id: string;
};
