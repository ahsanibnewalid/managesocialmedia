import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { decryptBillingCredentials, encryptBillingCredentials } from "@/lib/billing-credentials";
import { hasTrustedRequestOrigin } from "@/lib/request-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({
  organizationId: z.number().int().positive().refine(Number.isSafeInteger, "organizationId must be a safe integer"),
  provider: z.enum(["sslcommerz", "international"]),
  enabled: z.boolean(),
  mode: z.enum(["sandbox", "live"]).default("sandbox"),
  credentials: z.record(z.string(), z.string().max(4096)).default({})
});
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error:"Authentication required" }, {status:401});
  const orgId = Number(request.nextUrl.searchParams.get("organizationId"));
  if (!Number.isSafeInteger(orgId) || orgId <= 0) return NextResponse.json({error:"Valid organizationId required"},{status:400});
  const member = await db.query("SELECT role FROM saas_organization_members WHERE organization_id=$1 AND user_id=$2",[orgId,user.id]);
  if (!["owner","admin","billing"].includes(member.rows[0]?.role)) return NextResponse.json({error:"Organization billing permission required"},{status:403});
  const result = await db.query("SELECT provider,enabled,mode,credential_ciphertext,updated_at FROM billing_provider_settings WHERE scope_type='organization' AND scope_id=$1 ORDER BY provider",[orgId]);
  return NextResponse.json({providers:result.rows.map((r:any)=>({provider:r.provider,enabled:r.enabled,mode:r.mode,configured:Boolean(r.credential_ciphertext),updatedAt:r.updated_at}))});
}
export async function PUT(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({error:"Authentication required"},{status:401});
  if (!hasTrustedRequestOrigin(request)) {
    return NextResponse.json({error:"Request origin is not trusted"},{status:403});
  }
  const parsed = schema.safeParse(await request.json().catch(()=>null));
  if (!parsed.success) return NextResponse.json({error:"Invalid provider settings",details:parsed.error.flatten()},{status:400});
  const {organizationId,provider,enabled,mode,credentials}=parsed.data;
  const member = await db.query("SELECT role FROM saas_organization_members WHERE organization_id=$1 AND user_id=$2",[organizationId,user.id]);
  if (!["owner","admin","billing"].includes(member.rows[0]?.role)) return NextResponse.json({error:"Organization billing permission required"},{status:403});
  if (provider==="international" && enabled) return NextResponse.json({error:"International checkout is not implemented yet. Keep this provider disabled until a supported adapter is added and tested."},{status:400});
  const allowedCredentialKeys = provider === "sslcommerz" ? new Set(["storeId", "storePassword"]) : new Set<string>();
  if (Object.keys(credentials).some(key => !allowedCredentialKeys.has(key))) {
    return NextResponse.json({error:"Unsupported credential field for this provider"},{status:400});
  }
  const existing=await db.query("SELECT credential_ciphertext,credential_iv,credential_tag FROM billing_provider_settings WHERE scope_type='organization' AND scope_id=$1 AND provider=$2",[organizationId,provider]);
  let merged:Record<string,string>={};
  if(existing.rows[0]?.credential_ciphertext){try{merged=decryptBillingCredentials({ciphertext:existing.rows[0].credential_ciphertext,iv:existing.rows[0].credential_iv,tag:existing.rows[0].credential_tag});}catch{return NextResponse.json({error:"Existing credentials cannot be decrypted. Check BILLING_CREDENTIALS_ENCRYPTION_KEY before rotating secrets."},{status:500});}}
  merged={...merged,...Object.fromEntries(Object.entries(credentials).filter(([,v])=>v.length>0))};
  if(provider==="sslcommerz"&&(!merged.storeId||!merged.storePassword))return NextResponse.json({error:"SSLCOMMERZ Store ID and Store Password are required"},{status:400});
  const encrypted=encryptBillingCredentials(merged);
  const client=await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO billing_provider_settings(scope_type,scope_id,provider,enabled,mode,credential_ciphertext,credential_iv,credential_tag,updated_by,updated_at)
       VALUES('organization',$1,$2,$3,$4,$5,$6,$7,$8,now())
       ON CONFLICT(scope_type,scope_id,provider) DO UPDATE SET enabled=EXCLUDED.enabled,mode=EXCLUDED.mode,credential_ciphertext=EXCLUDED.credential_ciphertext,credential_iv=EXCLUDED.credential_iv,credential_tag=EXCLUDED.credential_tag,updated_by=EXCLUDED.updated_by,updated_at=now()`,
      [organizationId,provider,enabled,mode,encrypted.ciphertext,encrypted.iv,encrypted.tag,user.id]
    );
    await client.query("INSERT INTO platform_audit_log(actor_user_id,organization_id,action,target_type,target_id,metadata) VALUES($1,$2,'organization.billing_provider.settings_updated','billing_provider',$3,$4::jsonb)",[user.id,organizationId,provider,JSON.stringify({enabled,mode,credentialKeys:Object.keys(credentials)})]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  return NextResponse.json({ok:true,provider,enabled,mode,configured:true,note:"Credentials are encrypted at rest and never returned by this endpoint."});
}
