import type { Job, JobStatus } from "./types";

/**
 * Un-ignoring an AI-filtered job records the override so the filter never flips it back.
 * filterReason is set to undefined (not deleted) because upsertJob shallow-merges over the stored job.
 */
export function withStatus(job: Job, status: JobStatus): Job {
  if (status === "ignoriert" || !job.filterReason) return { ...job, status };
  return { ...job, status, filterReason: undefined, filterOverride: true };
}
