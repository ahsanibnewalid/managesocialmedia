import { z } from "zod";

/** Reject workspace IDs that cannot be represented exactly by JavaScript numbers. */
export const safeWorkspaceIdSchema = z.coerce
  .number()
  .int()
  .positive()
  .refine(Number.isSafeInteger, "Workspace ID must be a safe positive integer");

/** A scheduled post must have a valid timestamp at least 30 seconds in the future. */
export function isValidScheduleDate(value: Date, now = Date.now()): boolean {
  const timestamp = value.getTime();
  return Number.isFinite(timestamp) && timestamp >= now + 30_000;
}
