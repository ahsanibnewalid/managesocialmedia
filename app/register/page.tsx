import Link from "next/link";
import { register } from "@/app/actions/auth";
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const message = params.error === "exists" ? "An account with that email already exists." :
    params.error === "invalid" ? "Check your name, email and password (12 characters minimum)." :
    params.error === "failed" ? "Registration could not be completed. Please try again." : "";
  return <main className="auth-shell"><section className="auth-card">
    <p className="eyebrow">TIDEPOST CONSOLE</p><h1>Create your workspace</h1>
    <p className="muted">One account creates your first private workspace.</p>
    {message && <p className="notice error" role="alert">{message}</p>}
    <form action={register} className="stack">
      <label>Name<input name="name" autoComplete="name" required minLength={2} maxLength={80}/></label>
      <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
      <label>Password<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128}/></label>
      <button className="primary" type="submit">Create account</button>
    </form>
    <p className="muted small">Already have an account? <Link href="/login">Sign in</Link></p>
  </section></main>;
}
