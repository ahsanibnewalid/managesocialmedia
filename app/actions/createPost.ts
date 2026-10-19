"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, requireWorkspaceRole } from "@/lib/auth";
import { enqueueScheduledPost } from "@/lib/publishing-queue";

const schema = z.object({
  workspaceId: z.coerce.number().int().positive(),
  text: z.string().trim().min(1).max(10_000),
  platforms: z.array(z.enum(["facebook","instagram","linkedin","x","tiktok"])).min(1).max(5),
  scheduledAt: z.string().datetime().optional().or(z.literal(""))
});
export type CreatePostState = { ok: boolean; message: string };
export async function createPost(_previous: CreatePostState, formData: FormData): Promise<CreatePostState> {
  const user = await getSessionUser();
  if (!user) return { ok:false, message:"Please sign in before creating a post." };
  const parsed = schema.safeParse({
    workspaceId:formData.get("workspaceId"),
    text:formData.get("text"),
    platforms:formData.getAll("platforms").map(String),
    scheduledAt:formData.get("scheduledAt") || ""
  });
  if (!parsed.success) return { ok:false, message:parsed.error.issues[0]?.message || "Invalid post details." };
  const data = parsed.data;
  const role = await requireWorkspaceRole(user.id, data.workspaceId, ["owner","admin","editor"]);
  if (!role) return { ok:false, message:"Workspace not found or you do not have permission to publish." };
  const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
  if (scheduledAt && scheduledAt.getTime() < Date.now() + 30_000) {
    return { ok:false, message:"Choose a schedule at least 30 seconds in the future." };
  }
  const status = scheduledAt ? "scheduled" : "draft";
  const client = await db.connect();
  let post: any;
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      "INSERT INTO posts(workspace_id,author_id,text,platforms,status,scheduled_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,workspace_id,text,platforms,status,scheduled_at,created_at",
      [data.workspaceId,user.id,data.text,data.platforms,status,scheduledAt]
    );
    post = inserted.rows[0];
    await client.query("INSERT INTO audit_log(user_id,workspace_id,action,metadata) VALUES($1,$2,$3,$4)",
      [user.id,data.workspaceId,"post.created",JSON.stringify({postId:post.id,status})]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Post creation failed", error instanceof Error ? error.message : "unknown error");
    return { ok:false, message:"Could not save the post. Please try again." };
  } finally { client.release(); }
  if (scheduledAt) {
    try { await enqueueScheduledPost(post.id, scheduledAt); }
    catch (error) {
      console.error("Post saved but enqueue failed", error instanceof Error ? error.message : "unknown error");
      revalidatePath("/dashboard");
      return { ok:true, message:"Post saved, but Redis queueing failed. It remains scheduled in the database and needs queue recovery." };
    }
  }
  revalidatePath("/dashboard");
  return { ok:true, message:scheduledAt ? "Post saved and added to the publishing queue." : "Draft saved." };
}
