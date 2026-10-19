import { login } from "@/app/actions/auth";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <main className="auth-shell"><section className="auth-card">
    <p className="eyebrow">TIDEPOST CONSOLE</p><h1>Welcome back</h1>
    <p className="muted">Sign in with the account you created for your Tidepost workspace.</p>
    {params.error && <p className="notice error" role="alert">Email or password was not accepted.</p>}
    <form action={login} className="stack">
      <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={128}/></label>
      <button className="primary" type="submit">Sign in</button>
    </form>
    <p className="muted small">Accounts can be created through the existing registration API. Registration UI is not yet included in this migration.</p>
  </section></main>;
}
