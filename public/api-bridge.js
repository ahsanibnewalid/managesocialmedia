(() => {
  const style = document.createElement("style");
  style.textContent = `
    #tp-api-launch{position:fixed;right:18px;bottom:18px;z-index:99990;border:0;border-radius:999px;padding:12px 16px;background:#0b6e6e;color:#fff;font:600 13px system-ui;box-shadow:0 8px 30px #0002;cursor:pointer}
    #tp-api-panel{position:fixed;right:18px;bottom:74px;z-index:99990;width:min(390px,calc(100vw - 28px));max-height:75vh;overflow:auto;background:var(--surface,#fff);color:var(--fg,#14202e);border:1px solid var(--line,#dbe1ea);border-radius:12px;padding:16px;box-shadow:0 18px 60px #0003;font:14px system-ui}
    #tp-api-panel input,#tp-api-panel textarea,#tp-api-panel select{display:block;width:100%;margin:6px 0 10px;padding:9px;border:1px solid #9aa8b8;border-radius:7px;background:transparent;color:inherit}
    #tp-api-panel button{border:1px solid #9aa8b8;border-radius:7px;padding:8px 10px;margin:3px;background:transparent;color:inherit;cursor:pointer}
    #tp-api-panel .tp-primary{background:#0b6e6e;color:#fff;border-color:#0b6e6e}
    #tp-api-panel .tp-muted{opacity:.75;font-size:12px}#tp-api-panel .tp-post{padding:9px 0;border-bottom:1px solid #9aa8b855;overflow-wrap:anywhere}
  `;
  document.head.appendChild(style);
  const launch = document.createElement("button");
  launch.id = "tp-api-launch"; launch.textContent = "Connect backend";
  launch.setAttribute("aria-expanded","false");
  const panel = document.createElement("section");
  panel.id = "tp-api-panel"; panel.hidden = true; panel.setAttribute("aria-label","Tidepost backend connection");
  document.body.append(launch,panel);
  let token = sessionStorage.getItem("tidepost_token") || "";
  let workspace = "";
  async function api(path, options={}) {
    const res = await fetch(path,{...options,headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{}),...(options.headers||{})}});
    const body = res.status===204?null:await res.json().catch(()=>({error:"Unexpected server response"}));
    if(!res.ok) throw new Error(body?.error || "Request failed ("+res.status+")");
    return body;
  }
  const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function shell(inner){panel.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><strong>Tidepost · Live API</strong><button id="tp-close" aria-label="Close">×</button></div>'+inner;panel.querySelector("#tp-close").onclick=()=>{panel.hidden=true;launch.setAttribute("aria-expanded","false")};}
  function showAuth(message="") {
    shell('<p class="tp-muted">Sign in to connect this console to your PostgreSQL-backed workspace. This does not connect a social network account.</p><div id="tp-msg" role="status">'+esc(message)+'</div><label>Name (registration only)<input id="tp-name" autocomplete="name" maxlength="80"></label><label>Email<input id="tp-email" type="email" autocomplete="email" required></label><label>Password (12+ characters to register)<input id="tp-password" type="password" autocomplete="current-password" required></label><button class="tp-primary" id="tp-login">Sign in</button><button id="tp-register">Create account</button>');
    panel.querySelector("#tp-login").onclick=()=>authenticate(false);
    panel.querySelector("#tp-register").onclick=()=>authenticate(true);
  }
  async function authenticate(register) {
    const email=panel.querySelector("#tp-email").value.trim(), password=panel.querySelector("#tp-password").value;
    const name=panel.querySelector("#tp-name").value.trim();
    try {
      const result=await api("/api/auth/"+(register?"register":"login"),{method:"POST",body:JSON.stringify(register?{name,email,password}:{email,password})});
      token=result.token;sessionStorage.setItem("tidepost_token",token);await showWorkspaces();
    } catch(e) { const msg=panel.querySelector("#tp-msg");if(msg)msg.textContent=e.message; }
  }
  async function showWorkspaces() {
    try {
      const [me,data]=await Promise.all([api("/api/auth/me"),api("/api/workspaces")]);
      const options=data.workspaces.map(w=>'<option value="'+esc(w.id)+'">'+esc(w.name)+' · '+esc(w.role)+'</option>').join("");
      shell('<p>Signed in as <strong>'+esc(me.user.name)+'</strong></p><label>Workspace<select id="tp-workspace">'+options+'</select></label><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="tp-primary" id="tp-load">Load saved posts</button><button id="tp-logout">Sign out</button></div><div id="tp-data" class="tp-muted" style="margin-top:10px">Select a workspace to view saved records.</div>');
      panel.querySelector("#tp-workspace").onchange=e=>{workspace=e.target.value};
      workspace=String(data.workspaces[0]?.id||"");
      panel.querySelector("#tp-load").onclick=()=>showPosts();
      panel.querySelector("#tp-logout").onclick=()=>{token="";workspace="";sessionStorage.removeItem("tidepost_token");showAuth("Signed out.")};
      if(workspace) await showPosts();
    } catch(e) { token="";sessionStorage.removeItem("tidepost_token");showAuth(e.message+" — please sign in again."); }
  }
  async function showPosts() {
    workspace=panel.querySelector("#tp-workspace")?.value||workspace;
    if(!workspace)return;
    const target=panel.querySelector("#tp-data");
    if(target)target.textContent="Loading saved posts…";
    try {
      const data=await api("/api/workspaces/"+encodeURIComponent(workspace)+"/posts");
      const posts=data.posts.map(p=>'<div class="tp-post"><strong>'+esc(p.status)+'</strong> · '+esc((p.platforms||[]).join(", "))+'<div>'+esc(p.text)+'</div><div class="tp-muted">'+esc(p.scheduled_at||p.created_at||"")+'</div></div>').join("")||'<p>No saved posts yet.</p>';
      if(target)target.innerHTML='<div><strong>Saved posts</strong> ('+data.posts.length+')</div>'+posts+'<hr><strong>Save a draft</strong><label>Caption<textarea id="tp-caption" rows="3" maxlength="10000" placeholder="Write a post…"></textarea></label><label>Platforms<select id="tp-platforms" multiple size="5"><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="linkedin">LinkedIn</option><option value="x">X</option><option value="tiktok">TikTok</option></select></label><button class="tp-primary" id="tp-save">Save draft to backend</button><div id="tp-save-msg" role="status"></div>';
      panel.querySelector("#tp-save").onclick=async()=>{
        const text=panel.querySelector("#tp-caption").value.trim();
        const platforms=Array.from(panel.querySelector("#tp-platforms").selectedOptions).map(o=>o.value);
        const msg=panel.querySelector("#tp-save-msg");
        try { await api("/api/workspaces/"+encodeURIComponent(workspace)+"/posts",{method:"POST",body:JSON.stringify({text,platforms,status:"draft"})});msg.textContent="Draft saved.";await showPosts(); }
        catch(e){msg.textContent=e.message}
      };
    } catch(e) { if(target)target.textContent=e.message; }
  }
  launch.onclick=async()=>{panel.hidden=!panel.hidden;launch.setAttribute("aria-expanded",String(!panel.hidden));if(!panel.hidden){if(token)await showWorkspaces();else showAuth()}};
  api("/api/health").then(d=>{launch.title="API "+d.database}).catch(()=>{launch.title="Backend unavailable — start server and configure PostgreSQL"});
})();