"use client";
import { useActionState, useRef } from "react";
import { createPost, type CreatePostState } from "@/app/actions/createPost";

const initialState: CreatePostState = { ok:false, message:"" };
export function PostComposer({ workspaceId }: { workspaceId: string }) {
  const [state, formAction, pending] = useActionState(createPost, initialState);
  return <form action={formAction} className="stack">
    <input type="hidden" name="workspaceId" value={workspaceId}/>
    <label>Caption<textarea name="text" required minLength={1} maxLength={10000} rows={5} placeholder="What would you like to share?"/></label>
    <fieldset><legend>Platforms</legend><div className="platforms">
      {(["facebook","instagram","linkedin","x","tiktok"] as const).map(p=><label className="check" key={p}><input type="checkbox" name="platforms" value={p}/><span>{p === "x" ? "X" : p[0].toUpperCase()+p.slice(1)}</span></label>)}
    </div></fieldset>
    <label>Image URL (required for Instagram)<input type="url" name="mediaUrl" placeholder="https://cdn.example.com/image.jpg" maxLength={2048}/></label>
    <input type="hidden" name="scheduledAt" ref={scheduleIso}/><label>Schedule (optional, in your local time)<input type="datetime-local" ref={scheduleInput}/></label>
    <button className="primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Save post"}</button>
    {state.message && <p className={state.ok ? "notice success" : "notice error"} role="status">{state.message}</p>}
    <p className="muted small">Scheduled jobs use Redis/BullMQ. Publishing requires approved provider API permissions and valid connected account tokens.</p>
  </form>;
}
