import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser, requireWorkspaceRole } from "@/lib/auth";
import { createPost } from "@/app/actions/createPost";
import { logout } from "@/app/actions/auth";

type Workspace = { id:string; name:string; role:string };
export const dynamic = "force-dynamic";
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const workspacesResult = await db.query<Workspace>(
    "SELECT w.id::text,w.name,wm.role FROM workspaces w JOIN workspace_members wm ON wm.workspace_id=w.id WHERE wm.user_id=$1 ORDER BY w.created_at ASC",
    [user.id]
  );
  const workspaces = workspacesResult.rows;
  if (!workspaces.length) return <main className="shell"><header className="topbar"><div><p className="eyebrow">TIDEPOST</p><h1>Dashboard</h1></div><form action={logout}><button className="quiet">Sign out</button></form></header><p>Your account has no workspace yet.</p></main>;
  const requested = Number(params.workspace || workspaces[0].id);
  const workspace = workspaces.find(w => Number(w.id) === requested) || workspaces[0];
  if (!await requireWorkspaceRole(user.id, Number(workspace.id), ["owner","admin","editor","viewer"])) redirect("/dashboard");
  const [postsResult, accountsResult, reachResult] = await Promise.all([
    db.query("SELECT id::text,text,platforms,status,scheduled_at,published_at,created_at FROM posts WHERE workspace_id=$1 ORDER BY COALESCE(scheduled_at,created_at) DESC LIMIT 100", [workspace.id]),
    db.query("SELECT id::text,platform,account_name,status FROM social_accounts WHERE workspace_id=$1 ORDER BY platform,account_name", [workspace.id]),
    // Reach is not currently ingested by any provider integration; do not fabricate a metric.
    db.query("SELECT 0::bigint AS total_reach")
  ]);
  const posts = postsResult.rows;
  const connected = accountsResult.rows.filter((a:any) => a.status === "connected").length;
  const scheduled = posts.filter((p:any) => p.status === "scheduled").length;
  const action = createPost.bind(null, { ok:false, message:"" });
  return <main className="shell">
    <header className="topbar"><div><p className="eyebrow">TIDEPOST CONSOLE</p><h1>Good to see you, {user.name}</h1><p className="muted">Workspace: {workspace.name} · {workspace.role}</p></div><form action={logout}><button className="quiet">Sign out</button></form></header>
    <section className="stats">
      <article className="stat"><span>Posts loaded</span><strong>{posts.length}</strong><small>Most recent 100</small></article>
      <article className="stat"><span>Scheduled</span><strong>{scheduled}</strong><small>Saved in this workspace</small></article>
      <article className="stat"><span>Connected accounts</span><strong>{connected}</strong><small>Provider connection records</small></article>
      <article className="stat"><span>Total reach</span><strong>—</strong><small>Analytics ingestion not configured</small></article>
    </section>
    <div className="columns">
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">COMPOSER</p><h2>Create a post</h2></div></div>
        <form action={action} className="stack">
          <input type="hidden" name="workspaceId" value={workspace.id}/>
          <label>Caption<textarea name="text" required minLength={1} maxLength={10000} rows={5} placeholder="What would you like to share?"/></label>
          <fieldset><legend>Platforms</legend><div className="platforms">{(["facebook","instagram","linkedin","x","tiktok"] as const).map(p=><label className="check" key={p}><input type="checkbox" name="platforms" value={p}/><span>{p === "x" ? "X" : p[0].toUpperCase()+p.slice(1)}</span></label>)}</div></fieldset>
          <label>Schedule (optional)<input type="datetime-local" name="scheduledAt" /></label>
          <button className="primary" type="submit">Save post</button>
          <p className="muted small">Scheduled jobs use Redis/BullMQ. Publishing only succeeds for providers whose approved API integration and account permissions are configured.</p>
        </form>
      </section>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">WORKSPACE</p><h2>Connected accounts</h2></div></div>
        {accountsResult.rows.length ? <ul className="account-list">{accountsResult.rows.map((a:any)=><li key={a.id}><span className="dot" data-status={a.status}/><div><strong>{a.account_name}</strong><small>{a.platform} · {a.status}</small></div></li>)}</ul> : <p className="muted">No social accounts connected yet.</p>}
      </section>
    </div>
    <section className="panel posts-panel"><div className="panel-heading"><div><p className="eyebrow">CONTENT LIBRARY</p><h2>Recent posts</h2></div><span className="pill">{posts.length} records</span></div>
      {posts.length ? <div className="post-list">{posts.map((p:any)=><article className="post-row" key={p.id}><div className="post-copy"><p>{p.text}</p><small>{(p.platforms || []).join(" · ")}{p.scheduled_at ? " · "+new Date(p.scheduled_at).toLocaleString() : ""}</small></div><span className={"status status-"+p.status}>{p.status}</span></article>)}</div> : <p className="muted">No posts saved yet. Create your first draft above.</p>}
    </section>
  </main>;
}
