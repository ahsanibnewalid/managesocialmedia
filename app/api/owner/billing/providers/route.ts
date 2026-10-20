import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { decryptBillingCredentials, encryptBillingCredentials, maskSecret } from "@/lib/billing-credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({
  provider: z.enum(["sslcommerz", "international"]),
  enabled: z.boolean(),
  mode: z.enum(["sandbox", "live"]).default("sandbox"),
  credentials: z.record(z.string(), z.string().max(4096)).default({})
});
function ownerAllowed(email: string) {
  const list = (process.env.TIDEPOST_OWNER_EMAILS || "").split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase());
}
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!ownerAllowed(user.email)) return NextResponse.json({ error: "Platform owner access required" }, { status: 403 });
  const result = await db.query(
    "SELECT provider,enabled,mode,credential_ciphertext,credential_iv,credential_tag,updated_at FROM billing_provider_settings WHERE scope_type='platform' AND scope_id=0 ORDER BY provider"
  );
  return NextResponse.json({ providers: result.rows.map((row:any) => ({ provider:row.provider,enabled:row.enabled,mode:row.mode,configured:Boolean(row.credential_ciphertext),updatedAt:row.updated_at })) });
}
export async function PUT(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!ownerAllowed(user.email)) return NextResponse.json({ error: "Platform owner access required" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid provider settings", details: parsed.error.flatten() }, { status: 400 });
  const {provider,enabled,mode,credentials} = parsed.data;
  if (provider === "sslcommerz" && (!credentials.storeId || !credentials.storePassword)) {
    return NextResponse.json({ error: "SSLCOMMERZ Store ID and Store Password are required" }, { status: 400 });
  }
  if (provider === "international" && enabled) {
    return NextResponse.json({ error: "International checkout is not implemented yet. Save it disabled until an eligible provider adapter is added and tested." }, { status: 400 });
  }
  const existing = await db.query("SELECT credential_ciphertext,credential_iv,credential_tag FROM billing_provider_settings WHERE scope_type='platform' AND scope_id=0 AND provider=$1",[provider]);
  let merged:Record<string,string> = {};
  if(existing.rows[0]?.credential_ciphertext) {
    try { merged = decryptBillingCredentials({ciphertext:existing.rows[0].credential_ciphertext,iv:existing.rows[0].credential_iv,tag:existing.rows[0].credential_tag}); }
    catch { return NextResponse.json({error:"Existing credentials cannot be decrypted. Check BILLING_CREDENTIALS_ENCRYPTION_KEY before rotating secrets."},{status:500}); }
  }
  merged = {...merged,...Object.fromEntries(Object.entries(credentials).filter(([,v])=>v.length>0))};
  if (provider === "sslcommerz" && (!merged.storeId || !merged.storePassword)) return NextResponse.json({ error: "SSLCOMMERZ Store ID and Store Password are required" }, { status: 400 });
  const encrypted = encryptBillingCredentials(merged);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO billing_provider_settings(scope_type,scope_id,provider,enabled,mode,credential_ciphertext,credential_iv,credential_tag,updated_by,updated_at)
       VALUES('platform',0,$1,$2,$3,$4,$5,$6,$7,now())
       ON CONFLICT(scope_type,scope_id,provider) DO UPDATE SET enabled=EXCLUDED.enabled,mode=EXCLUDED.mode,credential_ciphertext=EXCLUDED.credential_ciphertext,credential_iv=EXCLUDED.credential_iv,credential_tag=EXCLUDED.credential_tag,updated_by=EXCLUDED.updated_by,updated_at=now()`,
      [provider,enabled,mode,encrypted.ciphertext,encrypted.iv,encrypted.tag,user.id]
    );
    await client.query("INSERT INTO platform_audit_log(actor_user_id,action,target_type,target_id,metadata) VALUES($1,'billing_provider.settings_updated','billing_provider',$2,$3::jsonb)",[user.id,provider,JSON.stringify({enabled,mode,credentialKeys:Object.keys(credentials)})]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  return NextResponse.json({ ok:true, provider, enabled, mode, configured:true, secretPreview:maskSecret("configured"), note:"Credentials are encrypted at rest and never returned by this endpoint." });
}
