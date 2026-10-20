"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/auth";
import { checkAuthRateLimit } from "@/lib/auth-rate-limit";

const loginSchema = z.object({ email:z.string().trim().email().max(254), password:z.string().min(1).max(128) });
const registerSchema = z.object({
  name:z.string().trim().min(2).max(80),
  email:z.string().trim().email().max(254),
  password:z.string().min(12).max(128)
});
export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse({ email:formData.get("email"), password:formData.get("password") });
  if (!parsed.success) redirect("/login?error=invalid");
  const rateLimit = await checkAuthRateLimit("login", parsed.data.email);
  if (rateLimit === "limited") redirect("/login?error=rate-limit");
  if (rateLimit === "unavailable") redirect("/login?error=unavailable");
  const result = await db.query("SELECT id,name,email,password_hash FROM users WHERE email=lower($1)", [parsed.data.email]);
  if (!result.rowCount || !(await bcrypt.compare(parsed.data.password, result.rows[0].password_hash))) redirect("/login?error=invalid");
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET must be configured with at least 32 characters");
  const token = jwt.sign({ sub:String(result.rows[0].id), email:result.rows[0].email }, secret, { expiresIn:"12h", issuer:"tidepost" });
  (await cookies()).set(COOKIE_NAME, token, { httpOnly:true, secure:process.env.NODE_ENV === "production", sameSite:"lax", path:"/", maxAge:12*60*60 });
  redirect("/dashboard");
}
export async function register(formData: FormData) {
  const parsed = registerSchema.safeParse({ name:formData.get("name"), email:formData.get("email"), password:formData.get("password") });
  if (!parsed.success) redirect("/register?error=invalid");
  const {name,email,password} = parsed.data;
  const rateLimit = await checkAuthRateLimit("register", email);
  if (rateLimit === "limited") redirect("/register?error=rate-limit");
  if (rateLimit === "unavailable") redirect("/register?error=unavailable");
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const userResult = await client.query(
      "INSERT INTO users(name,email,password_hash) VALUES($1,lower($2),$3) RETURNING id",
      [name,email,await bcrypt.hash(password,12)]
    );
    const userId = userResult.rows[0].id;
    const workspace = await client.query("INSERT INTO workspaces(name,owner_id) VALUES($1,$2) RETURNING id", [name + "'s workspace",userId]);
    await client.query("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'owner')", [workspace.rows[0].id,userId]);
    await client.query("COMMIT");
  } catch (error:any) {
    await client.query("ROLLBACK");
    if (error?.code === "23505") redirect("/register?error=exists");
    console.error("Registration failed", error instanceof Error ? error.message : "unknown error");
    redirect("/register?error=failed");
  } finally { client.release(); }
  redirect("/login?created=1");
}
export async function logout() {
  (await cookies()).delete(COOKIE_NAME);
  redirect("/login");
}
