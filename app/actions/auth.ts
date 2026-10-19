"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/auth";

const loginSchema = z.object({ email:z.string().trim().email().max(254), password:z.string().min(1).max(128) });
export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse({ email:formData.get("email"), password:formData.get("password") });
  if (!parsed.success) redirect("/login?error=invalid");
  const result = await db.query("SELECT id,name,email,password_hash FROM users WHERE email=lower($1)", [parsed.data.email]);
  if (!result.rowCount || !(await bcrypt.compare(parsed.data.password, result.rows[0].password_hash))) redirect("/login?error=invalid");
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET must be configured with at least 32 characters");
  const token = jwt.sign({ sub:String(result.rows[0].id), email:result.rows[0].email }, secret, { expiresIn:"12h", issuer:"tidepost" });
  (await cookies()).set(COOKIE_NAME, token, { httpOnly:true, secure:process.env.NODE_ENV === "production", sameSite:"lax", path:"/", maxAge:12*60*60 });
  redirect("/dashboard");
}
export async function logout() {
  (await cookies()).delete(COOKIE_NAME);
  redirect("/login");
}
