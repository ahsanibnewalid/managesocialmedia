import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { BillingProviderSettings } from "@/app/owner/billing/BillingProviderSettings";
export const dynamic = "force-dynamic";
export default async function OwnerBillingPage() {
 const user=await getSessionUser();
 if(!user) redirect("/login");
 const allow=(process.env.TIDEPOST_OWNER_EMAILS||"").split(",").map(v=>v.trim().toLowerCase()).filter(Boolean);
 if(!allow.includes(user.email.toLowerCase())) redirect("/dashboard");
 return <main className="shell"><header className="topbar"><div><p className="eyebrow">TIDEPOST PLATFORM</p><h1>Payment provider settings</h1><p className="muted">Configure the merchant credentials Tidepost uses to receive subscription payments.</p></div><a className="quiet" href="/dashboard">Back to dashboard</a></header><BillingProviderSettings endpoint="/api/owner/billing/providers" scopeLabel="Tidepost subscription payments"/></main>;
}
