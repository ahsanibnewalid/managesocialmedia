import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BillingProviderSettings } from "@/app/owner/billing/BillingProviderSettings";
export const dynamic="force-dynamic";
export default async function OrganizationBillingPage({searchParams}:{searchParams:Promise<{organizationId?:string}>}) {
 const user=await getSessionUser(); if(!user) redirect("/login");
 const p=await searchParams; const id=Number(p.organizationId);
 if(!Number.isSafeInteger(id)||id<=0) return <main className="shell"><h1>Organization billing</h1><p>Open this page with your organization ID, for example /organization/billing?organizationId=123.</p></main>;
 const member=await db.query("SELECT role FROM saas_organization_members WHERE organization_id=$1 AND user_id=$2",[id,user.id]);
 if(!["owner","admin","billing"].includes(member.rows[0]?.role)) redirect("/dashboard");
 return <main className="shell"><header className="topbar"><div><p className="eyebrow">ORGANIZATION SETTINGS</p><h1>Client payment provider settings</h1><p className="muted">These credentials are for a future agency client-billing feature, not for paying Tidepost subscriptions.</p></div><a className="quiet" href="/dashboard">Back to dashboard</a></header><BillingProviderSettings endpoint={"/api/organization/billing/providers?organizationId="+id} scopeLabel="Your organization's client payments"/></main>;
}
