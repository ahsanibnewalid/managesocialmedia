"use client";
import { useEffect, useState } from "react";
type Provider = {provider:string;enabled:boolean;mode:string;configured:boolean;updatedAt?:string};
export function BillingProviderSettings({endpoint,scopeLabel}:{endpoint:string;scopeLabel:string}) {
 const [providers,setProviders]=useState<Provider[]>([]);
 const [provider,setProvider]=useState("sslcommerz");
 const [enabled,setEnabled]=useState(false);
 const [mode,setMode]=useState("sandbox");
 const [storeId,setStoreId]=useState("");
 const [storePassword,setStorePassword]=useState("");
 const [internationalSecret,setInternationalSecret]=useState("");
 const [status,setStatus]=useState("Loading settings…");
 const [busy,setBusy]=useState(false);
 async function load(){try{const r=await fetch(endpoint,{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not load settings");setProviders(d.providers||[]);setStatus("Settings loaded. Existing secrets are never displayed.");}catch(e){setStatus(e instanceof Error?e.message:"Could not load settings");}}
 useEffect(()=>{void load();},[endpoint]);
 async function save(){setBusy(true);setStatus("Saving encrypted credentials…");try{
  const credentials:Record<string,string>={};
  if(provider==="sslcommerz"){if(storeId.trim())credentials.storeId=storeId.trim();if(storePassword)credentials.storePassword=storePassword;}
  else if(internationalSecret)credentials.secretKey=internationalSecret;
  const r=await fetch(endpoint,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({provider,enabled,mode,credentials})});
  const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not save settings");
  setStoreId("");setStorePassword("");setInternationalSecret("");setStatus("Saved. Credentials are encrypted at rest; this setting does not mean checkout is live yet.");await load();
 }catch(e){setStatus(e instanceof Error?e.message:"Could not save settings");}finally{setBusy(false);}}
 const current=providers.find(p=>p.provider===provider);
 return <section className="panel" style={{maxWidth:760}}>
  <p className="eyebrow">PAYMENTS</p><h2>{scopeLabel}</h2>
  <p className="muted">Choose a provider and enter credentials here. Secret values are write-only and will not be shown again.</p>
  <label className="field"><span>Provider</span><select value={provider} onChange={e=>setProvider(e.target.value)}><option value="sslcommerz">SSLCOMMERZ (Bangladesh)</option><option value="international">International provider (adapter not yet enabled)</option></select></label>
  <label className="field"><span>Mode</span><select value={mode} onChange={e=>setMode(e.target.value)}><option value="sandbox">Sandbox / test</option><option value="live">Live production</option></select></label>
  {provider==="sslcommerz"?<><label className="field"><span>Store ID</span><input autoComplete="off" value={storeId} onChange={e=>setStoreId(e.target.value)} placeholder={current?.configured?"Configured — enter a replacement to rotate":"Enter merchant Store ID"}/></label><label className="field"><span>Store Password</span><input type="password" autoComplete="new-password" value={storePassword} onChange={e=>setStorePassword(e.target.value)} placeholder={current?.configured?"Configured — enter a replacement to rotate":"Enter merchant Store Password"}/></label></>:<label className="field"><span>Provider secret key</span><input type="password" autoComplete="new-password" value={internationalSecret} onChange={e=>setInternationalSecret(e.target.value)} placeholder="International adapter not yet implemented"/></label>}
  <label className="field" style={{display:"flex",alignItems:"center",gap:10}}><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Enable provider configuration</label>
  <p className="muted">{current?.configured?"Credentials are stored.":"No credentials saved for this provider."} Enabling settings does not activate checkout until server-side validation and payment routes are implemented.</p>
  <button type="button" disabled={busy} onClick={()=>void save()}>{busy?"Saving…":"Save provider credentials"}</button>
  <p role="status" aria-live="polite" className="muted">{status}</p>
  {providers.length>0&&<div><h3>Saved provider settings</h3><ul>{providers.map(p=><li key={p.provider}>{p.provider} · {p.mode} · {p.enabled?"enabled":"disabled"} · {p.configured?"credentials saved":"not configured"}</li>)}</ul></div>}
 </section>;
}
