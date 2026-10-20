import Link from "next/link";
import { login } from "@/app/actions/auth";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; created?: string }> }) {
  const params = await searchParams;
  return <main className="auth-shell"><section className="auth-card">
    <p className="eyebrow">TIDEPOST CONSOLE</p><h1>Welcome back</h1>
    <p className="muted">Sign in to your social content workspace.</p>
    {params.error && <p className="notice error" role="alert">{params.error === "rate-limit" ? "Too many sign-in attempts. Please wait before trying again." : params.error === "unavailable" ? "Sign-in is temporarily unavailable. Please try again later." : "Email or password was not accepted."}</p>}
    {params.created && <p className="notice success" role="status">Account created. You can sign in now.</p>}
    <form action={login} className="stack">
      <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={128}/></label>
      <button className="primary" type="submit">Sign in</button>
    </form>
    <p className="muted small">New to Tidepost? <Link href="/register">Create an account</Link></p>
  </section></main>;
}
