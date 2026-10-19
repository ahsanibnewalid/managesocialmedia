require("dotenv").config();
const path = require("node:path");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const { z } = require("zod");

const app = express();
const port = Number(process.env.PORT || 3000);
const production = process.env.NODE_ENV === "production";
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  if (production) throw new Error("JWT_SECRET must be set to at least 32 characters in production");
  console.warn("WARNING: Set a random JWT_SECRET (32+ characters) before deploying.");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});
app.set("trust proxy", production ? 1 : false);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: "draft-7", legacyHeaders: false }));

const schema = `
CREATE TABLE IF NOT EXISTS users (
 id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS workspaces (
 id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS workspace_members (
 workspace_id BIGINT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','admin','editor','viewer')),
 PRIMARY KEY(workspace_id,user_id)
);
CREATE TABLE IF NOT EXISTS posts (
 id BIGSERIAL PRIMARY KEY, workspace_id BIGINT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, text TEXT NOT NULL,
 platforms TEXT[] NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scheduled','published','failed')),
 scheduled_at TIMESTAMPTZ, published_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS social_accounts (
 id BIGSERIAL PRIMARY KEY, workspace_id BIGINT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 platform TEXT NOT NULL, account_name TEXT NOT NULL, external_id TEXT,
 status TEXT NOT NULL DEFAULT 'disconnected' CHECK(status IN ('connected','disconnected','error')),
 token_ciphertext TEXT, token_expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS inbox_threads (
 id BIGSERIAL PRIMARY KEY, workspace_id BIGINT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 platform TEXT NOT NULL, external_thread_id TEXT, contact_name TEXT NOT NULL,
 kind TEXT NOT NULL DEFAULT 'comment', body TEXT NOT NULL, sentiment TEXT NOT NULL DEFAULT 'neutral',
 unread BOOLEAN NOT NULL DEFAULT true, assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS inbox_replies (
 id BIGSERIAL PRIMARY KEY, thread_id BIGINT NOT NULL REFERENCES inbox_threads(id) ON DELETE CASCADE,
 author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, body TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_log (
 id BIGSERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
 workspace_id BIGINT REFERENCES workspaces(id) ON DELETE CASCADE, action TEXT NOT NULL,
 metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS posts_workspace_schedule_idx ON posts(workspace_id, scheduled_at);
CREATE INDEX IF NOT EXISTS inbox_workspace_unread_idx ON inbox_threads(workspace_id, unread, created_at DESC);
`;
let dbReady;
async function initDb() {
  if (dbReady) return dbReady;
  dbReady = (async () => { await pool.query(schema); })();
  return dbReady;
}
const asyncRoute = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
function signToken(user) {
  return jwt.sign({ sub: String(user.id), email: user.email }, jwtSecret || "dev-only-change-me", { expiresIn: "12h", issuer: "tidepost" });
}
function auth(req,res,next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    const payload = jwt.verify(token, jwtSecret || "dev-only-change-me", { issuer: "tidepost" });
    req.userId = Number(payload.sub);
    next();
  } catch { return res.status(401).json({ error: "Session expired or invalid" }); }
}
const registerSchema = z.object({ name:z.string().trim().min(2).max(80), email:z.string().trim().email().max(254), password:z.string().min(12).max(128) });
const loginSchema = z.object({ email:z.string().trim().email().max(254), password:z.string().min(1).max(128) });
const postSchema = z.object({ text:z.string().trim().min(1).max(10000), platforms:z.array(z.enum(["facebook","instagram","linkedin","x","tiktok"])).min(1).max(5), status:z.enum(["draft","scheduled"]).default("draft"), scheduledAt:z.string().datetime().optional().nullable() });
async function workspaceAccess(userId, workspaceId, roles = ["owner","admin","editor","viewer"]) {
  const r = await pool.query("SELECT wm.role FROM workspace_members wm WHERE wm.user_id=$1 AND wm.workspace_id=$2", [userId, workspaceId]);
  return r.rowCount && roles.includes(r.rows[0].role) ? r.rows[0].role : null;
}
async function audit(userId, workspaceId, action, metadata={}) {
  await pool.query("INSERT INTO audit_log(user_id,workspace_id,action,metadata) VALUES($1,$2,$3,$4)", [userId, workspaceId, action, JSON.stringify(metadata)]);
}
app.get("/api/health", asyncRoute(async (req,res) => {
  await initDb(); await pool.query("SELECT 1");
  res.json({ ok:true, service:"tidepost-api", database:"connected", time:new Date().toISOString() });
}));
app.post("/api/auth/register", rateLimit({windowMs:60*60*1000,limit:8,standardHeaders:true,legacyHeaders:false}), asyncRoute(async (req,res) => {
  await initDb();
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error:"Invalid registration details", details:parsed.error.flatten().fieldErrors});
  const {name,email,password}=parsed.data;
  const hash=await bcrypt.hash(password,12);
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    const created=await client.query("INSERT INTO users(name,email,password_hash) VALUES($1,lower($2),$3) RETURNING id,name,email,created_at",[name,email,hash]);
    const user=created.rows[0];
    const ws=await client.query("INSERT INTO workspaces(name,owner_id) VALUES($1,$2) RETURNING id,name",[name+"'s workspace",user.id]);
    await client.query("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'owner')",[ws.rows[0].id,user.id]);
    await client.query("COMMIT");
    res.status(201).json({user,workspace:ws.rows[0],token:signToken(user)});
  } catch(e) {
    await client.query("ROLLBACK");
    if (e.code==="23505") return res.status(409).json({error:"An account with this email already exists"});
    throw e;
  } finally { client.release(); }
}));
app.post("/api/auth/login", rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:true,legacyHeaders:false}), asyncRoute(async (req,res) => {
  await initDb();
  const parsed=loginSchema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:"Email and password are required"});
  const r=await pool.query("SELECT id,name,email,password_hash FROM users WHERE email=lower($1)",[parsed.data.email]);
  if(!r.rowCount || !(await bcrypt.compare(parsed.data.password,r.rows[0].password_hash))) return res.status(401).json({error:"Invalid email or password"});
  const {password_hash,...user}=r.rows[0];
  res.json({user,token:signToken(user)});
}));
app.get("/api/auth/me",auth,asyncRoute(async(req,res)=>{
  const r=await pool.query("SELECT id,name,email,created_at FROM users WHERE id=$1",[req.userId]);
  if(!r.rowCount) return res.status(401).json({error:"Account not found"});
  res.json({user:r.rows[0]});
}));
app.get("/api/workspaces",auth,asyncRoute(async(req,res)=>{
  const r=await pool.query("SELECT w.id,w.name,wm.role,w.created_at FROM workspaces w JOIN workspace_members wm ON wm.workspace_id=w.id WHERE wm.user_id=$1 ORDER BY w.created_at",[req.userId]);
  res.json({workspaces:r.rows});
}));
app.get("/api/workspaces/:id/overview",auth,asyncRoute(async(req,res)=>{
  const id=Number(req.params.id);
  if(!Number.isSafeInteger(id)||!await workspaceAccess(req.userId,id)) return res.status(404).json({error:"Workspace not found"});
  const [posts,accounts,inbox]=await Promise.all([
    pool.query("SELECT status,count(*)::int AS count FROM posts WHERE workspace_id=$1 GROUP BY status",[id]),
    pool.query("SELECT platform,account_name,status FROM social_accounts WHERE workspace_id=$1 ORDER BY platform",[id]),
    pool.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE unread)::int AS unread FROM inbox_threads WHERE workspace_id=$1",[id])
  ]);
  res.json({posts:posts.rows,accounts:accounts.rows,inbox:inbox.rows[0]});
}));
app.get("/api/workspaces/:id/posts",auth,asyncRoute(async(req,res)=>{
  const id=Number(req.params.id);
  if(!await workspaceAccess(req.userId,id)) return res.status(404).json({error:"Workspace not found"});
  const r=await pool.query("SELECT p.id,p.text,p.platforms,p.status,p.scheduled_at,p.published_at,p.created_at,p.updated_at,u.name AS author FROM posts p JOIN users u ON u.id=p.author_id WHERE p.workspace_id=$1 ORDER BY COALESCE(p.scheduled_at,p.created_at) DESC LIMIT 200",[id]);
  res.json({posts:r.rows});
}));
app.post("/api/workspaces/:id/posts",auth,asyncRoute(async(req,res)=>{
  const id=Number(req.params.id), role=await workspaceAccess(req.userId,id,["owner","admin","editor"]);
  if(!role) return res.status(404).json({error:"Workspace not found or access denied"});
  const parsed=postSchema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:"Invalid post",details:parsed.error.flatten().fieldErrors});
  const d=parsed.data;
  if(d.status==="scheduled" && !d.scheduledAt) return res.status(400).json({error:"scheduledAt is required for scheduled posts"});
  const r=await pool.query("INSERT INTO posts(workspace_id,author_id,text,platforms,status,scheduled_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",[id,req.userId,d.text,d.platforms,d.status,d.status==="scheduled"?d.scheduledAt:null]);
  await audit(req.userId,id,"post.created",{postId:r.rows[0].id,status:d.status});
  res.status(201).json({post:r.rows[0],notice:"Saved in Tidepost. Publishing requires an authorized platform connection."});
}));
app.patch("/api/workspaces/:id/posts/:postId",auth,asyncRoute(async(req,res)=>{
  const id=Number(req.params.id), postId=Number(req.params.postId);
  if(!await workspaceAccess(req.userId,id,["owner","admin","editor"])) return res.status(404).json({error:"Workspace not found or access denied"});
  const parsed=postSchema.partial().safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:"Invalid post",details:parsed.error.flatten().fieldErrors});
  const current=await pool.query("SELECT * FROM posts WHERE id=$1 AND workspace_id=$2",[postId,id]);
  if(!current.rowCount) return res.status(404).json({error:"Post not found"});
  const d={...current.rows[0],...parsed.data};
  const r=await pool.query("UPDATE posts SET text=$1,platforms=$2,status=$3,scheduled_at=$4,updated_at=now() WHERE id=$5 AND workspace_id=$6 RETURNING *",[d.text,d.platforms,d.status,d.scheduledAt||d.scheduled_at||null,postId,id]);
  await audit(req.userId,id,"post.updated",{postId});
  res.json({post:r.rows[0]});
}));
app.delete("/api/workspaces/:id/posts/:postId",auth,asyncRoute(async(req,res)=>{
  const id=Number(req.params.id),postId=Number(req.params.postId);
  if(!await workspaceAccess(req.userId,id,["owner","admin","editor"])) return res.status(404).json({error:"Workspace not found or access denied"});
  const r=await pool.query("DELETE FROM posts WHERE id=$1 AND workspace_id=$2 RETURNING id",[postId,id]);
  if(!r.rowCount) return res.status(404).json({error:"Post not found"});
  await audit(req.userId,id,"post.deleted",{postId});
  res.status(204).end();
}));
app.get("/api/workspaces/:id/inbox",auth,asyncRoute(async(req,res)=>{
  const id=Number(req.params.id);
  if(!await workspaceAccess(req.userId,id)) return res.status(404).json({error:"Workspace not found"});
  const r=await pool.query("SELECT t.*,COALESCE((SELECT json_agg(json_build_object('id',x.id,'body',x.body,'authorId',x.author_id,'createdAt',x.created_at) ORDER BY x.created_at) FROM inbox_replies x WHERE x.thread_id=t.id),'[]'::json) AS replies FROM inbox_threads t WHERE t.workspace_id=$1 ORDER BY t.created_at DESC LIMIT 200",[id]);
  res.json({threads:r.rows});
}));
app.patch("/api/workspaces/:id/inbox/:threadId",auth,asyncRoute(async(req,res)=>{
  const id=Number(req.params.id),threadId=Number(req.params.threadId);
  if(!await workspaceAccess(req.userId,id,["owner","admin","editor"])) return res.status(404).json({error:"Workspace not found or access denied"});
  const parsed=z.object({unread:z.boolean().optional(),assignedTo:z.number().int().positive().nullable().optional()}).safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:"Invalid inbox update"});
  const d=parsed.data;
  const r=await pool.query("UPDATE inbox_threads SET unread=COALESCE($1,unread),assigned_to=CASE WHEN $2::boolean THEN $3::bigint ELSE assigned_to END WHERE id=$4 AND workspace_id=$5 RETURNING *",[d.unread??null,Object.hasOwn(d,"assignedTo"),d.assignedTo??null,threadId,id]);
  if(!r.rowCount) return res.status(404).json({error:"Thread not found"});
  res.json({thread:r.rows[0]});
}));
app.post("/api/workspaces/:id/inbox/:threadId/replies",auth,asyncRoute(async(req,res)=>{
  const id=Number(req.params.id),threadId=Number(req.params.threadId);
  if(!await workspaceAccess(req.userId,id,["owner","admin","editor"])) return res.status(404).json({error:"Workspace not found or access denied"});
  const parsed=z.object({body:z.string().trim().min(1).max(5000)}).safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:"Reply body is required"});
  const found=await pool.query("SELECT id FROM inbox_threads WHERE id=$1 AND workspace_id=$2",[threadId,id]);
  if(!found.rowCount) return res.status(404).json({error:"Thread not found"});
  const r=await pool.query("INSERT INTO inbox_replies(thread_id,author_id,body) VALUES($1,$2,$3) RETURNING *",[threadId,req.userId,parsed.data.body]);
  await audit(req.userId,id,"inbox.reply_saved",{threadId});
  res.status(201).json({reply:r.rows[0],notice:"Reply saved locally. Sending to the social network requires a connected provider API."});
}));
app.get("/api/workspaces/:id/audit",auth,asyncRoute(async(req,res)=>{
  const id=Number(req.params.id);
  if(!await workspaceAccess(req.userId,id,["owner","admin"])) return res.status(404).json({error:"Workspace not found or access denied"});
  const r=await pool.query("SELECT id,user_id,action,metadata,created_at FROM audit_log WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 200",[id]);
  res.json({events:r.rows});
}));
app.use("/api",(_req,res)=>res.status(404).json({error:"API route not found"}));
app.get("/",(_req,res)=>res.sendFile(path.join(__dirname,"..","Tidepost Console.html")));
app.use(express.static(path.join(__dirname,"..","public"),{index:false, dotfiles:"deny"}));
app.use((err,req,res,next)=>{
  if(err && err.code==="23505") return res.status(409).json({error:"A record with that value already exists"});
  console.error("Request failed:",err.message);
  res.status(500).json({error:"Internal server error"});
});
initDb().then(()=>{
  app.listen(port,()=>console.log(`Tidepost API listening on port ${port}`));
}).catch(err=>{console.error("Database initialization failed:",err.message);process.exit(1);});
