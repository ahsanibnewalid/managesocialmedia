import test from "node:test";
import assert from "node:assert/strict";
import { isValidScheduleDate, safeWorkspaceIdSchema } from "../lib/post-validation";

test("workspace IDs accept safe positive integers only", () => {
  assert.equal(safeWorkspaceIdSchema.safeParse("42").success, true);
  assert.equal(safeWorkspaceIdSchema.safeParse(Number.MAX_SAFE_INTEGER).success, true);
  assert.equal(safeWorkspaceIdSchema.safeParse("0").success, false);
  assert.equal(safeWorkspaceIdSchema.safeParse("-1").success, false);
  assert.equal(safeWorkspaceIdSchema.safeParse("9007199254740992").success, false);
  assert.equal(safeWorkspaceIdSchema.safeParse(Number.POSITIVE_INFINITY).success, false);
});

test("schedule validation rejects invalid, past, and too-soon dates", () => {
  const now = 1_800_000_000_000;
  assert.equal(isValidScheduleDate(new Date(Number.NaN), now), false);
  assert.equal(isValidScheduleDate(new Date(now - 1), now), false);
  assert.equal(isValidScheduleDate(new Date(now + 29_999), now), false);
  assert.equal(isValidScheduleDate(new Date(now + 30_000), now), true);
  assert.equal(isValidScheduleDate(new Date(now + 30_001), now), true);
});
