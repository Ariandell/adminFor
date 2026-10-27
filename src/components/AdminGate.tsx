import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { supabase } from '../supabaseClient';
import { createAdminAccess, type AdminAccessSnapshot } from '../lib/adminAccess';

export default function AdminGate({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<AdminAccessSnapshot>({ status: 'checking', accountId: null });
  const state = access.status;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let receivedAuthEvent = false;
    const guard = createAdminAccess(async () => {
      // Auth callbacks run under the SDK's session lock. Query after it releases.
      await new Promise<void>(resolve => window.setTimeout(resolve, 0));
      const { data, error: roleError } = await supabase.rpc('is_anglica_admin');
      return !roleError && data === true;
    }, setAccess);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedAuthEvent = true;
      void guard.update(session?.user.id ?? null);
    });
    // INITIAL_SESSION normally handles this. Ignore a stale bootstrap response
    // if a newer sign-in, refresh or sign-out has already arrived.
    void supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
      if (!receivedAuthEvent) void guard.update(sessionError ? null : session?.user.id ?? null);
    }).catch(() => { if (!receivedAuthEvent) void guard.update(null); });
    return () => { guard.dispose(); subscription.unsubscribe(); };
  }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setError('');
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(), password,
    });
    if (signInError) setError('Не вдалося увійти. Перевір пошту й пароль.');
  }

  async function signInWithGoogle() {
    setError('');
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (signInError) setError('Не вдалося відкрити вхід через Google.');
  }

  if (state === 'allowed') return <>{children}</>;

  return <main className="min-h-screen flex items-center justify-center bg-paper-100 px-5 py-12 text-ink">
    <section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-cozy border border-lavender-100">
      <h1 className="text-2xl font-extrabold">EnglishAdmin</h1>
      {state === 'checking' ? <p className="mt-5 text-ink-500">Перевіряємо доступ…</p> :
        state === 'denied' ? <>
          <p className="mt-5 text-ink-600">Для цього акаунта доступ до адмінки не надано.</p>
          <button type="button" className="mt-6 rounded-xl border border-lavender-200 px-4 py-2 font-semibold" onClick={() => void supabase.auth.signOut()}>Увійти іншим акаунтом</button>
        </> : <>
          <p className="mt-2 text-ink-500">Увійди в акаунт адміністратора.</p>
          <form className="mt-6 space-y-4" onSubmit={signIn}>
            <label className="block text-sm font-semibold">Електронна пошта
              <input className="mt-1 w-full rounded-xl border border-lavender-200 px-3 py-3" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} />
            </label>
            <label className="block text-sm font-semibold">Пароль
              <input className="mt-1 w-full rounded-xl border border-lavender-200 px-3 py-3" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />
            </label>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <button className="w-full rounded-xl bg-lavender-500 px-4 py-3 font-bold text-white" type="submit">Увійти</button>
          </form>
          <button type="button" className="mt-4 w-full rounded-xl border border-lavender-200 px-4 py-3 font-semibold" onClick={() => void signInWithGoogle()}>Продовжити з Google</button>
        </>}
    </section>
  </main>;
}
